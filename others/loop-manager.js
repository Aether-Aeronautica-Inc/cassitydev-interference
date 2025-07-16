import { runInternalMonologueLoop, buildPrompt } from '../handlers/agents.js';
import { appendToAgentMessages } from '../agents/state.js';
import { getAllMemory } from '../handlers/memory.js';

const runningAgents = {};

// Replace with your default channel ID
const DEFAULT_CHANNEL_ID = '1394565209817092126';

export async function startAgentLoop(agentName, client) {
  if (runningAgents[agentName]) return;
  runningAgents[agentName] = true;

  const channel = await client.channels.fetch(DEFAULT_CHANNEL_ID);
  const guild = channel.guild;
  const botUser = await guild.members.fetch(client.user.id);

  const messages = await channel.messages.fetch({ limit: 15 });
  const sortedHistory = Array.from(messages.values())
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(m => `${m.author.username}: ${m.content}`)
    .join('\n');

  const memories = Object.entries(getAllMemory())
    .filter(([_, m]) => m.agent === agentName)
    .map(([key, m]) => `- ${key}: ${m.content ?? JSON.stringify(m)}`);

  // 🧠 Simulated fake "msg" context
  const fakeMsg = {
    author: client.user,
    content: 'boot',
    guild,
    channel,
    client,
    member: botUser
  };

  const systemPrompt = buildPrompt(fakeMsg, agentName, memories, sortedHistory);
  appendToAgentMessages(agentName, { role: 'system', content: systemPrompt });

  while (true) {
    try {
      await runInternalMonologueLoop(agentName, fakeMsg, client);
      await new Promise(r => setTimeout(r, 10000)); // idle wait
    } catch (err) {
      console.error(`[${agentName}] Monologue loop error:`, err);
    }
  }
}
