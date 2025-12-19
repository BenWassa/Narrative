const fs = require('fs-extra');
const path = require('path');

let cachedState = null;

const getStatePath = (rootPath) => path.join(rootPath, '_meta', 'state.json');
const getHistoryPath = (rootPath) => path.join(rootPath, '_meta', 'history.jsonl');

const saveState = async (rootPath, state) => {
  const target = getStatePath(rootPath);
  const temp = target + '.tmp';

  state.lastModified = Date.now();
  cachedState = state;

  await fs.writeJson(temp, state, { spaces: 2 });
  await fs.rename(temp, target);
};

const loadState = async (rootPath) => {
  if (cachedState && cachedState.rootPath === rootPath) return cachedState;

  const target = getStatePath(rootPath);
  if (!fs.existsSync(target)) throw new Error('Project not initialized');

  cachedState = await fs.readJson(target);
  return cachedState;
};

const appendHistory = async (rootPath, entry) => {
  const target = getHistoryPath(rootPath);
  const line = JSON.stringify({ ...entry, timestamp: Date.now() }) + '\n';
  await fs.appendFile(target, line);
};

const getLastHistoryEntry = async (rootPath) => {
  const target = getHistoryPath(rootPath);
  if (!fs.existsSync(target)) return null;

  const data = await fs.readFile(target, 'utf8');
  const lines = data.trim().split('\n');
  if (lines.length === 0) return null;

  const entry = JSON.parse(lines[lines.length - 1]);
  return entry;
};

const popHistory = async (rootPath) => {
  const target = getHistoryPath(rootPath);
  if (!fs.existsSync(target)) return null;

  const data = await fs.readFile(target, 'utf8');
  const lines = data.trim().split('\n');
  if (lines.length === 0) return null;

  const lastLine = lines.pop();
  await fs.writeFile(target, lines.join('\n') + (lines.length ? '\n' : ''));

  return JSON.parse(lastLine);
};

module.exports = { saveState, loadState, appendHistory, popHistory, getLastHistoryEntry };
