// src/main.js
import { loadMemory } from './handlers/memory.js';
import { createBot } from './others/bot-manager.js';

// Load memory
await loadMemory();

// Keep process alive
import './others/dev-panel.js' // Build information & dev access panel

// Environment variable
import dotenv from 'dotenv';
dotenv.config(/** { path: "/etc/secrets/.env" } **/);

const cassitydev = createBot(process.env.DISCORD_TOKEN, 'Cassitydev');
cassitydev; // Run the bot instance if needed

process.on('SIGINT', () => {
    console.log('Shutting down...');
    cassitydev.destroy();
    process.exit(0);
});