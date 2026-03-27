const { normalizePhone } = require('../excelReader');

test('9-digit mobile gets 51 prefix', () => {
  expect(normalizePhone('987654321')).toEqual({ phone: '51987654321', valid: true });
});

test('strips spaces and dashes before normalizing', () => {
  expect(normalizePhone('987 654-321')).toEqual({ phone: '51987654321', valid: true });
});

test('+51 prefix stripped and accepted', () => {
  expect(normalizePhone('+51987654321')).toEqual({ phone: '51987654321', valid: true });
});

test('11-digit starting with 51 accepted as-is', () => {
  expect(normalizePhone('51987654321')).toEqual({ phone: '51987654321', valid: true });
});

test('10-digit number marked invalid', () => {
  expect(normalizePhone('5198765432').valid).toBe(false);
});

test('8-digit number marked invalid', () => {
  expect(normalizePhone('98765432').valid).toBe(false);
});

test('11-digit with non-51 country code marked invalid', () => {
  expect(normalizePhone('15551234567').valid).toBe(false);
});

test('Excel numeric cell value (no quotes) handled correctly', () => {
  expect(normalizePhone(987654321)).toEqual({ phone: '51987654321', valid: true });
});
