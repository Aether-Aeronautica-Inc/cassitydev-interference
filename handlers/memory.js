import fs from 'fs/promises';

const MEMORY_FILE = './sandbox/memory.json';
const MAX_TOKENS = 1800; // configurable token budget
const DECAY_RATE = 0.95; // weight multiplier per decay cycle

let memoryCache = {}; // Format: { [aiId]: { key: { content, weight, timestamp } } }

function estimateTokens(text) {
  return Math.ceil(text.length / 4); // ~4 chars per token
}

function estimateEntryTokens(entry) {
  if (typeof entry === 'string') return estimateTokens(entry);
  if (typeof entry === 'object' && entry.content)
    return estimateTokens(entry.content);
  return estimateTokens(JSON.stringify(entry));
}

export async function loadMemory() {
  try {
    const raw = await fs.readFile(MEMORY_FILE, 'utf-8');
    memoryCache = JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`⚠️ Memory load failed: ${err.message}`);
    }
  }
}

export async function saveMemory() {
  try {
    await fs.writeFile(MEMORY_FILE, JSON.stringify(memoryCache, null, 2));
  } catch (err) {
    // fail silently
  }
}

export function getMemory(key, aiId = 'Cassitydev') {
  return memoryCache[aiId]?.[key];
}

export function getAllMemory(aiId = 'Cassitydev') {
  return memoryCache[aiId] || {};
}

export function clearMemory(aiId = null) {
  if (aiId) {
    delete memoryCache[aiId];
  } else {
    memoryCache = {};
  }
}

export function setMemory(key, value, aiId = 'Cassitydev', weight = 1.0) {
  if (!memoryCache[aiId]) memoryCache[aiId] = {};
  memoryCache[aiId][key] = {
    content: value,
    weight,
    timestamp: Date.now()
  };
  return value;
}

export async function storeMemory(aiId, entry, weight = 1.0) {
  if (!memoryCache[aiId]) memoryCache[aiId] = {};
  const key = `msg:${new Date().toISOString()}`;
  memoryCache[aiId][key] = {
    ...entry,
    weight,
  };

  trimMemoryToFit(aiId);
  await saveMemory();
}

export function decayMemory(aiId) {
  if (!memoryCache[aiId]) return;

  for (const key in memoryCache[aiId]) {
    memoryCache[aiId][key].weight *= DECAY_RATE;
    if (memoryCache[aiId][key].weight < 0.1) {
      delete memoryCache[aiId][key]; // purge very decayed memory
    }
  }
}

function trimMemoryToFit(aiId, maxTokens = MAX_TOKENS) {
  if (!memoryCache[aiId]) return;

  const entries = Object.entries(memoryCache[aiId]);

  // Sort by: weight DESC, timestamp DESC
  const sorted = entries.sort(([, a], [, b]) => {
    const wa = a.weight ?? 1;
    const wb = b.weight ?? 1;
    if (wa !== wb) return wb - wa;
    return b.timestamp - a.timestamp;
  });

  let totalTokens = 0;
  const trimmed = [];

  for (const [key, entry] of sorted) {
    const tokens = estimateEntryTokens(entry);
    if (totalTokens + tokens <= maxTokens) {
      trimmed.push([key, entry]);
      totalTokens += tokens;
    } else {
      break;
    }
  }

  memoryCache[aiId] = Object.fromEntries(trimmed);
}

// Optional: decay all AIs' memory (cron job style)
export function decayAllMemory() {
  for (const aiId of Object.keys(memoryCache)) {
    decayMemory(aiId);
  }
}
