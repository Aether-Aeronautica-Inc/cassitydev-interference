// src/others/agent-router.js
import { injectUserMessage } from "../agents/state.js";
import { query, getPersonality, buildPrompt } from "../handlers/agents.js";
import { storeMemory } from "../handlers/memory.js";

import index from "../index.js";

export async function handleMessageRouter(msg, agentName) {
  if (!index.disable_internal_monologue) {
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

    return;
  }

  msg.channel.send(await query([
    { role: "user", content: msg.content },
    { role: "system", content: getPersonality(agentName) || "" },
    { role: "system", content: buildPrompt(msg, agentName) },
  ], agentName));
}
