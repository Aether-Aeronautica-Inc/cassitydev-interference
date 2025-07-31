// src/others/loopManager.js
import { runInternalMonologueLoop, buildPrompt } from '../handlers/agents.js';
import { appendToAgentMessages, getAgentMessages } from '../agents/state.js';
import { getAllMemory, setMemory, saveMemory } from '../handlers/memory.js';

const runningAgents = {};
const DEFAULT_CHANNEL_ID = '1394565209817092126';
const MAX_MEMORY_ENTRIES = 50;

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

  // Clean old memory first
  const allMemories = Object.entries(getAllMemory(agentName))
    .filter(([_, m]) => m.agent === agentName);

  const trimmed = allMemories
    .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
    .slice(0, MAX_MEMORY_ENTRIES);

  const memories = trimmed.map(([key, m]) => `- ${key}: ${m.content ?? JSON.stringify(m)}`);

  const cleanMemory = {};
  for (const [key, val] of trimmed) {
    cleanMemory[key] = val;
  }
  // setMemory('__cleaned__', true, agentName); // marker
  await saveMemory();

  // Fake msg context
  const fakeMsg = {
    author: client.user,
    content: 'boot',
    guild,
    channel,
    client,
    member: botUser
  };

  const systemPrompt = buildPrompt(fakeMsg, agentName, memories, sortedHistory);
  
  // Clear any existing messages and add the proper system prompt
  const agentMessages = getAgentMessages(agentName);
  agentMessages.length = 0; // Clear existing messages
  appendToAgentMessages(agentName, { role: 'system', content: systemPrompt });
  
  console.log(`[${agentName}] System prompt added: ${systemPrompt.substring(0, 200)}...`);

  while (true) {
    try {
      await runInternalMonologueLoop(agentName, fakeMsg, client);
      await new Promise(r => setTimeout(r, 10000));
    } catch (err) {
      console.error(`[${agentName}] Monologue loop error:`, err);
    }
  }
}