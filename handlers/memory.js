import fs from 'fs/promises';
const MEMORY_FILE = './sandbox/memory.json';

let memoryCache = {};

export async function loadMemory() {
  try {
    const raw = await fs.readFile(MEMORY_FILE, 'utf-8');
    memoryCache = JSON.parse(raw);
  } catch (err) {
    memoryCache = {};
  }
}

export async function saveMemory() {
  await fs.writeFile(MEMORY_FILE, JSON.stringify(memoryCache, null, 2));
}

export function getMemory(key) {
  return memoryCache[key];
}

export function setMemory(key, value) {
  memoryCache[key] = value;
  return value;
}

export function getAllMemory() {
  return memoryCache;
}

export function clearMemory() {
  memoryCache = {};
}

export async function storeMemory(entry) {
  const key = `msg:${entry.timestamp}`;
  memoryCache[key] = entry;
  fs.writeFile(MEMORY_FILE, JSON.stringify(memoryCache, null, 2));
}