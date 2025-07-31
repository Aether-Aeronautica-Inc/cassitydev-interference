// src/others/agent-router.js
import { injectUserMessage } from "../agents/state.js";
import { query } from "../handlers/agents.js";
import actions from "../handlers/actions.js";
import { storeMemory } from "../handlers/memory.js";

import index from "../index.js";

const availableIntents = Object.entries(actions).map(([name, fn]) => {
  const args = fn.toString().match(/\(\{([^}]*)\}/);
  const argList = args?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [];
  return `- ${name}(${argList.join(', ')})`;
}).join('\n');

const messages = [
  { role: "system", content: `🛠️ Available Actions:\n${availableIntents}` },
]

export async function handleMessageRouter(msg, agentName) {
  if (!index.disable_internal_monologue) {
    // Inject user message into the loop
    injectUserMessage(agentName, `<@${msg.author.id}> said: "${msg.content}"`);

    const now = new Date().toISOString();
    await storeMemory(agentName, {
      user_id: msg.author.id,
      content: msg.content,
      timestamp: now,
      channel: msg.channel.name,
      agent: agentName,
    });

    return;
  }

  messages.push({ role: "user", content: `${msg.author.tag}: ${msg.content}` });
  const response = await query([
    ...messages,
  ], agentName);
  messages.push({ role: "assistant", content: response || "Unable to send a response." });
  msg.channel.send(response || "Unable to send a response.");
}
