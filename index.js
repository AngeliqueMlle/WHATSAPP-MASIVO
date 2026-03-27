const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');

const stateManager = require('./src/stateManager');
const { readContacts } = require('./src/excelReader');
const { randomDelay, getNextLongPauseThreshold, renderMessage, waitForBusinessHours } = require('./src/scheduler');
const { createSender } = require('./src/sender');

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const mode = args.includes('--retry')   ? 'retry'
           : args.includes('--dry-run') ? 'dry-run'
           : args[0] === '--test'       ? 'test'
           : 'normal';
const testPhone = mode === 'test' ? args[1] : null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadConfig() {
  const p = path.resolve('config.json');
  if (!fs.existsSync(p)) { console.error('[ERROR] config.json no encontrado.'); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadTemplate() {
  const p = path.resolve('message.txt');
  if (!fs.existsSync(p)) { console.error('[ERROR] message.txt no encontrado.'); process.exit(1); }
  return fs.readFileSync(p, 'utf8');
}

function validateExcel(config) {
  if (!fs.existsSync(path.resolve(config.excel.file))) {
    console.error(`[ERROR] Archivo Excel no encontrado: ${config.excel.file}`);
    process.exit(1);
  }
}

function normalizeCliPhone(raw) {
  const str = String(raw).replace(/\D/g, '');
  if (str.length === 9) return '51' + str;
  if (str.length === 11 && str.startsWith('51')) return str;
  return str;
}

function timestamp() {
  return new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function longPauseMs(config) {
  const { min, max } = config.delays.pauseDuration;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function printSummary(sent, failed, durationMs) {
  console.log(`\n=== RESUMEN ===`);
  console.log(`Enviados exitosamente:  ${sent}`);
  console.log(`Fallidos:               ${failed}`);
  console.log(`Duración:               ${formatDuration(durationMs)}`);
  console.log(`===============\n`);
}

// ── WA client factory ─────────────────────────────────────────────────────────
function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      protocolTimeout: 120000
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  return new Promise((resolve, reject) => {
    client.on('qr', qr => {
      console.log('\n[QR] Escaneá el código con WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      console.log('[OK] WhatsApp conectado.\n');
      resolve(client);
    });

    client.on('auth_failure', () => reject(new Error('Autenticación fallida')));

    client.on('disconnected', reason => {
      const state = stateManager.getState();
      console.error(`\n[ERROR] WhatsApp desconectado: ${reason}`);
      console.error(`[INFO] Progreso guardado. lastProcessedIndex=${state.lastProcessedIndex}`);
      process.exit(1);
    });

    client.initialize();
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
main().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });

async function main() {
  const config = loadConfig();
  const template = loadTemplate();

  if (mode === 'dry-run') { await runDryRun(config, template); return; }

  validateExcel(config);
  const client = await createClient();
  const sender = createSender(client);

  if      (mode === 'test')  await runTest(sender, template, config);
  else if (mode === 'retry') await runRetry(sender, template, config);
  else                       await runNormal(sender, template, config);

  // Esperar que WhatsApp termine de entregar antes de cerrar
  await new Promise(r => setTimeout(r, 5000));
  await client.destroy();
}

// ── NORMAL ────────────────────────────────────────────────────────────────────
async function runNormal(sender, template, config) {
  const contacts = readContacts(config.excel);
  const state = stateManager.getState();
  const startIdx = state.lastProcessedIndex + 1;
  let { sentCount } = state;

  // Mark all invalid contacts as failed upfront
  contacts.forEach(c => {
    if (!c.valid) stateManager.addFailed(c, 'invalid phone format');
  });

  const startTime = Date.now();
  let sent = 0, failed = 0;
  let countSinceLastPause = 0;
  let pauseThreshold = getNextLongPauseThreshold(config.delays);

  for (let i = startIdx; i < contacts.length; i++) {
    const contact = contacts[i];

    if (!contact.valid) {
      stateManager.saveState(i, sentCount);
      continue;
    }

    await waitForBusinessHours(config.schedule);

    const registered = await sender.isRegistered(contact.phone);
    if (!registered) {
      console.log(`[${timestamp()}] ✗ No registrado: ${contact.phone} (${contact.name || '-'})`);
      stateManager.addFailed(contact, 'not registered');
      stateManager.saveState(i, sentCount);
      failed++;
      continue;
    }

    const message = renderMessage(template, contact.name);
    try {
      await sender.sendMessage(contact.phone, message);
      sentCount++;
      sent++;
      stateManager.saveState(i, sentCount);
      console.log(`[${timestamp()}] ✓ Enviado a ${contact.phone} (${contact.name || '-'})`);
    } catch (err) {
      console.log(`[${timestamp()}] ✗ Error: ${contact.phone} — ${err.message}`);
      stateManager.addFailed(contact, err.message);
      stateManager.saveState(i, sentCount);
      failed++;
      continue;
    }

    await randomDelay(config.delays.minBetweenMessages, config.delays.maxBetweenMessages);

    countSinceLastPause++;
    if (countSinceLastPause >= pauseThreshold) {
      const pauseMs = longPauseMs(config);
      console.log(`[${timestamp()}] ⏸ Pausa larga: ${pauseMs / 1000}s...`);
      await new Promise(r => setTimeout(r, pauseMs));
      countSinceLastPause = 0;
      pauseThreshold = getNextLongPauseThreshold(config.delays);
    }
  }

  printSummary(sent, failed, Date.now() - startTime);
}

// ── RETRY ─────────────────────────────────────────────────────────────────────
async function runRetry(sender, template, config) {
  const failed = stateManager.getFailed();
  if (failed.length === 0) {
    console.log('[INFO] No hay fallidos para reintentar.');
    return;
  }

  console.log(`[INFO] Reintentando ${failed.length} números fallidos...\n`);
  const startTime = Date.now();
  let sent = 0, stillFailed = 0;
  let countSinceLastPause = 0;
  let pauseThreshold = getNextLongPauseThreshold(config.delays);

  for (const contact of failed) {
    await waitForBusinessHours(config.schedule);

    const registered = await sender.isRegistered(contact.phone);
    if (!registered) {
      console.log(`[${timestamp()}] ✗ Sigue sin registro: ${contact.phone} (${contact.name || '-'})`);
      stateManager.addFailed(contact, 'not registered');
      stillFailed++;
      continue;
    }

    const message = renderMessage(template, contact.name);
    try {
      await sender.sendMessage(contact.phone, message);
      stateManager.removeFailed(contact.phone);
      sent++;
      console.log(`[${timestamp()}] ✓ Reenviado a ${contact.phone} (${contact.name || '-'})`);
    } catch (err) {
      console.log(`[${timestamp()}] ✗ Error al reintentar ${contact.phone}: ${err.message}`);
      stateManager.addFailed(contact, err.message);
      stillFailed++;
      continue;
    }

    await randomDelay(config.delays.minBetweenMessages, config.delays.maxBetweenMessages);

    countSinceLastPause++;
    if (countSinceLastPause >= pauseThreshold) {
      const pauseMs = longPauseMs(config);
      console.log(`[${timestamp()}] ⏸ Pausa larga: ${pauseMs / 1000}s...`);
      await new Promise(r => setTimeout(r, pauseMs));
      countSinceLastPause = 0;
      pauseThreshold = getNextLongPauseThreshold(config.delays);
    }
  }

  printSummary(sent, stillFailed, Date.now() - startTime);
}

// ── TEST ──────────────────────────────────────────────────────────────────────
async function runTest(sender, template, config) {
  if (!testPhone) {
    console.error('[ERROR] Usá: node index.js --test 519XXXXXXXX');
    process.exit(1);
  }
  const phone = normalizeCliPhone(testPhone);
  console.log(`[TEST] Enviando mensaje de prueba a: ${phone}`);

  const registered = await sender.isRegistered(phone);
  if (!registered) {
    console.warn(`[ADVERTENCIA] ${phone} no está registrado en WhatsApp. Enviando de todas formas...`);
  }

  const message = renderMessage(template, 'Test');
  try {
    await sender.sendMessage(phone, message);
    console.log(`[TEST] ✓ Enviado exitosamente.`);
    console.log(`[TEST] Mensaje:\n${message}`);
  } catch (err) {
    console.error(`[TEST] ✗ Error: ${err.message}`);
  }
}

// ── DRY-RUN ───────────────────────────────────────────────────────────────────
async function runDryRun(config, template) {
  console.log('=== DRY RUN ===');

  if (!fs.existsSync(path.resolve(config.excel.file))) {
    console.error(`Archivo Excel no encontrado: ${config.excel.file}`);
    process.exit(1);
  }

  const contacts = readContacts(config.excel);
  const { lastProcessedIndex } = stateManager.getState();
  const failedCount = stateManager.getFailed().length;
  const pending = contacts.slice(lastProcessedIndex + 1).filter(c => c.valid);

  const now = DateTime.now().setZone(config.schedule.timezone);
  const inHours = now.hour >= config.schedule.startHour && now.hour < config.schedule.endHour;

  console.log(`Archivo Excel:           ${config.excel.file} (${contacts.length} contactos)`);
  console.log(`Estado actual:           lastProcessedIndex=${lastProcessedIndex} → próximo desde fila ${lastProcessedIndex + 1}`);
  console.log(`Pendientes:              ${pending.length} contactos por enviar`);
  console.log(`Fallidos (failed.json):  ${failedCount} números`);
  console.log(`Horario actual:          ${now.toFormat('HH:mm')} Lima — ${inHours ? 'DENTRO' : 'FUERA'} del horario (${config.schedule.startHour}:00–${config.schedule.endHour}:00)`);

  if (pending.length > 0) {
    const first = pending[0];
    const message = renderMessage(template, first.name);
    console.log(`\nPrimer contacto pendiente:`);
    console.log(`  Número: ${first.phone}`);
    console.log(`  Nombre: ${first.name || '(sin nombre)'}`);
    console.log(`  Mensaje:`);
    console.log(`  ${'─'.repeat(25)}`);
    message.split('\n').forEach(l => console.log(`  ${l}`));
    console.log(`  ${'─'.repeat(25)}`);
  }

  console.log('===============');
}
