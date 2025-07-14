// src/main.js

import { createBot } from './others/bot-manager.js';
import { loadMemory } from './handlers/memory.js';

// Environment variable
import dotenv from 'dotenv';
dotenv.config({ path: "/etc/secrets/.env" });

// Keep process alive
import './others/dev-panel.js' // Build information & dev access panel

// Load memory
await loadMemory();

const cassitydev = createBot(process.env.DISCORD_TOKEN_1, 'Cassitydev');
cassitydev; // Run the bot instance if needed

process.on('SIGINT', () => {
    console.log('Shutting down...');
    cassitydev.destroy();
    process.exit(0);
});