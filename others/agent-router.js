// src/agent-router.js
import { executeIntent } from '../handlers/executor.js';
import { queryGroq } from '../handlers/agents.js';
import rateLimiter from '../rate-limiter.js';

export async function handleMessage(msg, agentName, client) {
  if (!rateLimiter.allow(agentName)) {
    console.log(`${agentName} is rate limited.`);
    return;
  }

  const prompt = `Incoming message in #${msg.channel.name}: ${msg.content}`;
  const thought = await queryGroq(prompt, agentName);

  // Extract intent from AI (you can parse JSON blocks)
  const intentMatch = thought.match(/```json([\s\S]+?)```/);
  if (intentMatch) {
    try {
      const intentJson = JSON.parse(intentMatch[1]);
      const result = await executeIntent(intentJson, msg, client);
      if (result && result.reply) {
        msg.channel.send(result.reply);
      }
    } catch (err) {
      console.error('Failed to execute action:', err);
    }
  } else {
    msg.channel.send(thought); // Just chat
  }

  rateLimiter.tick(agentName);
}
