// src/others/agent-router.js
import { injectUserMessage } from "../agents/state.js";
import { storeMemory } from "../handlers/memory.js";

export async function handleMessageRouter(msg, agentName) {
  // Inject user message into the loop
  injectUserMessage(agentName, `<@${msg.author.id}> said: "${msg.content}"`);

  const now = new Date().toISOString();
  await storeMemory({
    user_id: msg.author.id,
    content: msg.content,
    timestamp: now,
    channel: msg.channel.name,
    agent: agentName,
  });
}
