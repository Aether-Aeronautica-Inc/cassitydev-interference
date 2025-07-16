// src/others/agent-router.js
import { handleMessage } from '../handlers/agents.js';
import rateLimiter from './rate-limiter.js';

export async function handleMessageRouter(msg, agentName, client) {
  if (!rateLimiter.allow(agentName)) return;
  await handleMessage(msg, agentName, client);
  rateLimiter.tick(agentName);
}
