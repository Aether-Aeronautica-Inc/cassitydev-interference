// src/main.js
import { loadMemory } from './handlers/memory.js';

// Load memory
await loadMemory();

// Keep process alive
import './others/dev-panel.js' // Build information & dev access panel