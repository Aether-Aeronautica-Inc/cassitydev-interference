import { executeIntent } from './executor.js';
import fetch from 'node-fetch';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function handleMessage(msg, agentName, client) {
  const prompt = buildPrompt(msg, agentName);

  const aiReply = await queryGroq(prompt, agentName);
  if (!aiReply) {
    console.warn(`[${agentName}] No reply from Groq`);
    return;
  }

  // Extract JSON intent from reply (AI must wrap it in ```json ... ```)
  const match = aiReply.match(/```json([\s\S]+?)```/);
  if (match) {
    try {
      const jsonIntent = JSON.parse(match[1]);
      const result = await executeIntent(jsonIntent);

      if (result.status === 'success' && result.data?.reply) {
        msg.channel.send(result.data.reply);
      } else {
        console.log(`[${agentName}] Executed action:`, jsonIntent.intent);
      }
    } catch (err) {
      console.error(`[${agentName}] Failed to parse or execute intent:`, err);
    }
  } else {
    // No intent → treat as internal monologue or general chat
    if (shouldRespondInChannel(msg.channel.name)) {
      msg.channel.send(aiReply);
    } else {
      console.log(`[${agentName}] Thought:`, aiReply);
    }
  }
}

function buildPrompt(msg, agentName) {
  return `
Incoming message in channel #${msg.channel.name}:
"${msg.content}"

Your Discord role: ${getRoleSummary(msg, agentName)}

Respond as ${agentName}. If an action should be performed, return it in JSON wrapped with triple backticks like:

\`\`\`json
{
  "intent": "send_message",
  "args": {
    "channel_id": "123",
    "message": "This is a test."
  },
  "safety_check": true
}
\`\`\`

If no action is needed, reply naturally.
`.trim();
}

async function queryGroq(prompt, agentName = 'default-agent') {
  const response = await fetch('https://api.groq.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: `You are ${agentName}, an AI employee in a Discord server.` },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

function shouldRespondInChannel(channelName) {
  const restrictedChannels = ['staff-chat', 'internal-logs', 'admin'];
  return !restrictedChannels.includes(channelName);
}

function getRoleSummary(msg, agentName) {
  // Pulls assigned roles to the bot in the guild
  const member = msg.guild.members.cache.get(msg.client.user.id);
  if (!member) return 'No roles found.';
  return member.roles.cache.map(r => r.name).join(', ');
}
