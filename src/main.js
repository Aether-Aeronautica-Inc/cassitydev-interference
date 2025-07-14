// src/main.js

import { createBot } from './bot-manager.js';

createBot(process.env.BOT_TOKEN_1, 'SupportAgent');
createBot(process.env.BOT_TOKEN_2, 'DevAgent');
createBot(process.env.BOT_TOKEN_3, 'ManagerAI');

