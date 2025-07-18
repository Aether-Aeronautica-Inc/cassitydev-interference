import { Client, GatewayIntentBits } from 'discord.js';
import { handleMessageRouter } from './agent-router.js';
import { startAgentLoop } from './loop-manager.js';

import index from '../index.js'

export function createBot(token, agentName) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.on('ready', () => {
    console.log(`[${agentName}] connected as ${client.user.tag}`);
    if (!index.disable_internal_monologue) startAgentLoop(agentName, client); 
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    await handleMessageRouter(msg, agentName);
  });

  client.login(token);
  return client;
}
