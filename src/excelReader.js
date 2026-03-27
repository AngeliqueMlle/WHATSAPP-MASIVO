const XLSX = require('xlsx');
const path = require('path');

function normalizePhone(raw) {
  const str = String(raw).replace(/\D/g, '');

  if (str.length === 9) {
    return { phone: '51' + str, valid: true };
  }
  if (str.length === 11 && str.startsWith('51')) {
    return { phone: str, valid: true };
  }
  return { phone: str, valid: false };
}

function readContacts(config) {
  const filePath = path.resolve(config.file);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[config.sheet]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const startRow = config.hasHeader ? 1 : 0;
  const contacts = [];

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const rawPhone = row[config.phoneColumn];
    if (rawPhone == null || rawPhone === '') continue;

    const { phone, valid } = normalizePhone(rawPhone);
    const name = config.nameColumn >= 0 ? (row[config.nameColumn] || null) : null;

    contacts.push({ phone, name: name ? String(name).trim() : null, valid });
  }

  return contacts;
}

module.exports = { normalizePhone, readContacts };
