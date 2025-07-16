import { Client, GatewayIntentBits } from 'discord.js';
import { handleMessageRouter } from './agent-router.js';

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
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    await handleMessageRouter(msg, agentName, client);
  });

  client.login(token);
  return client;
}
