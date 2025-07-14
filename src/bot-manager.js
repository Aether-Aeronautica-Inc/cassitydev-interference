// src/bot-manager.js
import { Client, GatewayIntentBits } from 'discord.js';
import { handleMessage } from './agent-router.js';

export function createBot(token, agentName) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

  client.on('ready', () => {
    console.log(`[${agentName}] connected as ${client.user.tag}`);
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Routing message to agent logic
    await handleMessage(msg, agentName, client);
  });

  client.login(token);
}
