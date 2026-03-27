const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let stateManager;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-test-'));
  process.env.DATA_DIR = tmpDir;
  jest.resetModules();
  stateManager = require('../stateManager');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.DATA_DIR;
});

test('getState returns defaults when state.json does not exist', () => {
  const state = stateManager.getState();
  expect(state).toEqual({ lastProcessedIndex: -1, sentCount: 0, lastRunAt: null });
});

test('saveState writes and getState reads back correctly', () => {
  stateManager.saveState(5, 5);
  const state = stateManager.getState();
  expect(state.lastProcessedIndex).toBe(5);
  expect(state.sentCount).toBe(5);
  expect(state.lastRunAt).not.toBeNull();
});

test('saveState creates data/ directory if it does not exist', () => {
  const dataDir = path.join(tmpDir, 'data');
  expect(fs.existsSync(dataDir)).toBe(false);
  stateManager.saveState(0, 0);
  expect(fs.existsSync(dataDir)).toBe(true);
});

test('getFailed returns empty array when failed.json does not exist', () => {
  expect(stateManager.getFailed()).toEqual([]);
});

test('addFailed inserts new entry', () => {
  stateManager.addFailed({ phone: '51987654321', name: 'Juan' }, 'not registered');
  const failed = stateManager.getFailed();
  expect(failed).toHaveLength(1);
  expect(failed[0].phone).toBe('51987654321');
  expect(failed[0].reason).toBe('not registered');
  expect(failed[0].failedAt).toBeTruthy();
});

test('addFailed upserts by phone — no duplicates, always updates failedAt and reason', () => {
  stateManager.addFailed({ phone: '51987654321', name: 'Juan' }, 'not registered');
  stateManager.addFailed({ phone: '51987654321', name: 'Juan' }, 'timeout');
  const failed = stateManager.getFailed();
  expect(failed).toHaveLength(1);
  expect(failed[0].reason).toBe('timeout');
});

test('removeFailed removes entry by phone', () => {
  stateManager.addFailed({ phone: '51987654321', name: 'Juan' }, 'not registered');
  stateManager.removeFailed('51987654321');
  expect(stateManager.getFailed()).toHaveLength(0);
});
