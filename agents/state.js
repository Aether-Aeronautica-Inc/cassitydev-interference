// src/agents/state.js

const agentState = {};

/**
 * Gets the full internal monologue and conversation state for an agent.
 */
export function getAgentMessages(agentName) {
  if (!agentState[agentName]) agentState[agentName] = [];
  return agentState[agentName];
}

/**
 * Appends a new message to the agent's state log.
 * Trims history to 50 to prevent memory bloat.
 */
export function appendToAgentMessages(agentName, msg) {
  const state = getAgentMessages(agentName);
  state.push(msg);
  if (state.length > 50) state.shift();
}

/**
 * Injects a user message into the ongoing agent state.
 */
export function injectUserMessage(agentName, userMsg) {
  appendToAgentMessages(agentName, {
    role: 'user',
    content: userMsg
  });
}

/**
 * Clears all agent messages for a reset.
 */
export function resetAgentMessages(agentName) {
  agentState[agentName] = [];
}
