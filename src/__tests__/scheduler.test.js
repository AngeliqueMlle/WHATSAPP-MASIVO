const { randomDelay, getNextLongPauseThreshold, renderMessage } = require('../scheduler');

test('randomDelay resolves within declared range', async () => {
  const start = Date.now();
  await randomDelay(50, 100);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThanOrEqual(45);
  expect(elapsed).toBeLessThan(500);
});

test('getNextLongPauseThreshold returns value within config range', () => {
  const config = { pauseEvery: { min: 10, max: 15 } };
  for (let i = 0; i < 100; i++) {
    const t = getNextLongPauseThreshold(config);
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThanOrEqual(15);
  }
});

test('renderMessage substitutes {nombre} with name', () => {
  expect(renderMessage('Hola {nombre}, bienvenido.', 'Juan')).toBe('Hola Juan, bienvenido.');
});

test('renderMessage removes {nombre} and cleans space when name is null', () => {
  expect(renderMessage('Hola {nombre}, bienvenido.', null)).toBe('Hola bienvenido.');
});

test('renderMessage returns message unchanged when template has no {nombre}', () => {
  expect(renderMessage('Mensaje genérico.', 'Juan')).toBe('Mensaje genérico.');
});

test('renderMessage handles {nombre} at end of sentence', () => {
  expect(renderMessage('Saludos, {nombre}.', null)).toBe('Saludos.');
});
