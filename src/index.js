// src/main.js

import { createBot } from './others/bot-manager.js';
import { loadMemory } from './handlers/memory.js';

// Environment variable
import dotenv from 'dotenv';
dotenv.config();

// Keep process alive
import './others/keep-alive.js';

// Load memory
await loadMemory();

createBot(process.env.DISCORD_TOKEN_1, 'Cassitydev');
createBot(process.env.DISCORD_TOKEN_2, 'DevAgent');
createBot(process.env.DISCORD_TOKEN_3, 'ManagerAI');

