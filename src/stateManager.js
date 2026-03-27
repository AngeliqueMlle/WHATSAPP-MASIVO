const fs = require('fs');
const path = require('path');

function getDataDir() {
  const base = process.env.DATA_DIR || process.cwd();
  return path.join(base, 'data');
}

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getState() {
  const file = path.join(getDataDir(), 'state.json');
  if (!fs.existsSync(file)) {
    return { lastProcessedIndex: -1, sentCount: 0, lastRunAt: null };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveState(lastProcessedIndex, sentCount) {
  const dir = ensureDataDir();
  fs.writeFileSync(
    path.join(dir, 'state.json'),
    JSON.stringify({ lastProcessedIndex, sentCount, lastRunAt: new Date().toISOString() }, null, 2)
  );
}

function getFailed() {
  const file = path.join(getDataDir(), 'failed.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveFailed(list) {
  const dir = ensureDataDir();
  fs.writeFileSync(path.join(dir, 'failed.json'), JSON.stringify(list, null, 2));
}

function addFailed(contact, reason) {
  const list = getFailed();
  const idx = list.findIndex(e => e.phone === contact.phone);
  const entry = {
    phone: contact.phone,
    name: contact.name || null,
    reason,
    failedAt: new Date().toISOString()
  };
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  saveFailed(list);
}

function removeFailed(phone) {
  saveFailed(getFailed().filter(e => e.phone !== phone));
}

module.exports = { getState, saveState, getFailed, addFailed, removeFailed };
