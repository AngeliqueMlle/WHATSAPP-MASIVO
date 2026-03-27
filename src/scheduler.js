const { DateTime } = require('luxon');

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getNextLongPauseThreshold(config) {
  const { min, max } = config.pauseEvery;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderMessage(template, name) {
  if (!name) {
    return template
      .replace(/,\s*\{nombre\}/g, '')
      .replace(/\{nombre\},?\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return template.replace(/\{nombre\}/g, name);
}

async function waitForBusinessHours(config) {
  const { startHour, endHour, timezone } = config;

  while (true) {
    const now = DateTime.now().setZone(timezone);
    if (now.hour >= startHour && now.hour < endHour) return;

    let next = now.set({ hour: startHour, minute: 0, second: 0, millisecond: 0 });
    if (next <= now) next = next.plus({ days: 1 });

    const secondsLeft = Math.ceil(next.diff(now, 'seconds').seconds);
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;

    process.stdout.write(
      `\r[HORARIO] Fuera de horario. Reanuda a las ${startHour}:00. Espera: ${h}h ${m}m ${s}s  `
    );

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

module.exports = { randomDelay, getNextLongPauseThreshold, renderMessage, waitForBusinessHours };
