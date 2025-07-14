// src/main.js
import { loadMemory } from './handlers/memory.js';

// Environment variable
import dotenv from 'dotenv';
dotenv.config({ path: "/etc/secrets/.env" });

// Load memory
await loadMemory();

// Keep process alive
import './others/dev-panel.js' // Build information & dev access panel