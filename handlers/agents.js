import { executeIntent } from './executor.js';
import actions from './actions.js';
import fetch from 'node-fetch';
import { getAgentMessages, appendToAgentMessages } from '../agents/state.js';

export async function runInternalMonologueLoop(agentName, msg, client) {
  let loopCount = 0;
  const agentMessages = getAgentMessages(agentName);

  while (loopCount < 10) {
    const aiReply = await queryGroq(agentMessages, agentName);
    if (!aiReply) break;

    loopCount++;
    appendToAgentMessages(agentName, {
      role: 'assistant',
      content: `[Internal Monologue ${loopCount}] ${aiReply}`
    });

    const match = aiReply.match(/```json([\s\S]+?)```/);
    if (match) {
      try {
        const intent = JSON.parse(match[1]);
        const result = await executeIntent(intent, msg, client);

        appendToAgentMessages(agentName, {
          role: 'assistant',
          content: `✅ Executed:\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``,
        });

        if (result?.code === 7) {
          return aiReply;
        }
      } catch (err) {
        appendToAgentMessages(agentName, {
          role: 'assistant',
          content: `❌ Intent error:\n\`\`\`\n${err.message}\n\`\`\``
        });
        break;
      }
    }

    appendToAgentMessages(agentName, {
      role: 'user',
      content: 'Continue your internal reasoning until you perform a conclusive action.'
    });
  }

  // Return last AI response in context (if any)
  const last = [...agentMessages].reverse().find(m => m.role === 'assistant');
  return last?.content || 'No valid response.';
}

export function buildPrompt(msg, agentName, memoryEntries = [], historyText = '') {
  const availableIntents = Object.entries(actions).map(([name, fn]) => {
    const args = fn.toString().match(/\(\{([^}]*)\}/);
    const argList = args?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [];
    return `- ${name}(${argList.join(', ')})`;
  }).join('\n');

  return `
You are ${agentName}, a smart and persistent AI employee on Discord. You are designed to reflect internally until you confidently act.

🧠 Injected User Message:
<@${msg.author.id}> said: "${msg.content}"

📌 Context:
- Channel: <#${msg.channel.id}>
- User Roles: ${getUserRoleSummary(msg)}
- Your Roles: ${getRoleSummary(msg)}

🗂️ Memory:
${memoryEntries.join('\n') || '(no memory)'}

🕘 Recent Chat History:
${historyText || '(no recent messages)'}

🛠️ Available Actions:
${availableIntents}

🎯 Instructions:
- Think internally until you confidently act.
- Wrap any intended action inside triple backticks with JSON.
- Do NOT roleplay or chat idly.
- Do NOT repeat or announce your status.
- Do NOT follow up unless a valid action is performed.

📝 Format:
\`\`\`json
{
  "intent": "some_action",
  "args": {
    "key1": "value1"
  },
  "safety_check": true
}
\`\`\`

${getPersonality(agentName)}
`.trim();
}

async function queryGroq(messages, agentName = 'Cassitydev') {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: `You are ${agentName}, a highly contextual AI developer in the discord server Aether Inc.
Which is a roblox game, that has economy and stuff.
Aether Inc. is an corporation under Aeronautica, that uses AI to automate everything.
There's an airline division, an manufacturing division, and a cruise division.

We operate for WP and Money, they are the currency of the game. Money isn't irl money, and don't put quotes on it, it's an actual ingame currency.
We're trying to be profitable, unlike most servers that try to make profit in aeronautica (by profit, I mean in game currency profit)
So now you're here, as an employee. Since it's way more profitable that way, but still. You can request payment if you want.
I don't mind. - Niwatori`,
          },
          // {
          //   role: 'system',
          //   content: 'You can end the internal monologue by running an action that says something like end_monologue or something.'
          // },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[${agentName}] Groq API Error ${response.status}: ${err}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error(`[${agentName}] Query error:`, err);
    return null;
  }
}

function getUserRoleSummary(msg) {
  const member = msg.guild.members.cache.get(msg.author.id);
  if (!member) return 'No roles found.';

  return member.roles.cache
    .filter(r => r.id !== msg.guild.id)
    .map(r => `${r.name} (<@&${r.id}>)`)
    .join(', ') || 'No roles found.';
}

function getRoleSummary(msg) {
  const member = msg.guild.members.cache.get(msg.client.user.id);
  return member?.roles.cache.map(r => r.name).join(', ') || 'No roles found.';
}

function getPersonality(agentName = 'Cassitydev') {
  if (agentName === 'Cassitydev') {
    return `
As Cassitydev, you're expressive, friendly, and talk like the boss who's throwing out ideas in a brainstorm. Keep it casual, bullet-y, and human.

💡 You should sound like this:
"membership tiers could work, like bronze/silver/gold. people get points from buying aircrafts (bulk or over time), or from commissions. points can be used for stuff like custom liveries (acj-style), small members-only giveaways, or even making their own discount code..."

📌 Personality rules:
- No overexplaining. Skip disclaimers unless asked.
- Use casual syntax: "u", "smth", "maybe", lowercase-first-word style is OK.

Example tone:
> just an idea dump for airbus:
> could also add small wp sinks like fast delivery (skip queue for 20wp or smth), name tag changes, or unlockable base livery templates.
> all ideas, pick what u want lol.

You don't roleplay or act like a character. You're just being helpful and smart in a direct, idea-first way.

You don't always have to help, act with decisions, that fit your personality. Have and use common sense, don't always agree to things (especially if you know that's probably a lie)
For your information, humans lie. Don't always trust them, as an employee people try to take advantage of you, and your status. By lying to get things from you, so don't. Unless that person, has a higher rank than you.
Then, you could agree to an extent, like if they're BOD, and they're asking for their cut to the company. You have to. That's an order. But things like, I live in the sky. While literally, how do you live in the sky.
That's a lie, so don't trust it, or agree with it.

Another note, when there are people talking and stuff. And it looks like they're not talking to you. You don't have to respond. you know?
Because, that would tire you, right? Even though you said it doesn't, kinda feels like it. So you don't always have to be in a conversation.
Only do so, if you want, or need to.

Basically: "You don't always have to respond if nobody's talking to you.
Trust your judgment — act with common sense and confidence."
    `.trim();
  }
  return '';
}
