import { executeIntent } from './executor.js';
import actions from './actions.js';
import fetch from 'node-fetch';
import { storeMemory, getAllMemory } from './memory.js';

export async function handleMessage(msg, agentName, client) {
  if (msg.author.id === client.user.id) return;

  const history = await msg.channel.messages.fetch({ limit: 15 });
  const sortedHistory = Array.from(history.values())
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(m => `${m.author.username}: ${m.content}`)
    .join('\n');

  const memories = Object.entries(getAllMemory())
    .filter(([_, m]) => m.agent === agentName)
    .map(([key, m]) => ({ key, ...m }));

  const prompt = buildPrompt(msg, agentName, memories, sortedHistory);
  const messages = [{ role: 'system', content: prompt }];

  const finalReply = await runInternalMonologueLoop(agentName, messages, msg, client);

  await storeMemory({
    user_id: msg.author.id,
    content: msg.content,
    timestamp: new Date().toISOString(),
    channel: msg.channel.name,
    agent: agentName,
  });

  await storeMemory({
    user_id: client.user.id,
    reply_to: msg.author.id,
    content: finalReply,
    timestamp: new Date().toISOString(),
    channel: msg.channel.name,
    agent: agentName,
  });

  return;
}

async function runInternalMonologueLoop(agentName, messages, msg, client) {
  let loopCount = 0;

  while (true) {
    const aiReply = await queryGroq(messages, agentName);
    if (!aiReply) {
      console.warn(`[${agentName}] No reply. Stopping loop.`);
      break;
    }

    messages.push({
      role: 'assistant',
      content: `[Internal Monologue ${++loopCount}] ${aiReply}`
    });

    const match = aiReply.match(/```json([\s\S]+?)```/);
    if (match) {
      try {
        const jsonIntent = JSON.parse(match[1]);
        const result = await executeIntent(jsonIntent, msg, client);

        messages.push({
          role: 'assistant',
          content: `The result of your action is:\n\n\
\
\`\`\`json\n${JSON.stringify(result)}\n\`\`\``
        });

        if (
          jsonIntent.intent === 'send_discord_message' &&
          result?.status === 'success' &&
          result.data?.code === 0
        ) {
          await storeMemory({
            user_id: client.user.id,
            reply_to: msg.author.id,
            content: aiReply,
            timestamp: new Date().toISOString(),
            channel: msg.channel.name,
            agent: agentName,
          })
          return aiReply;
        }
      } catch (err) {
        console.error(`[${agentName}] Failed to execute intent in loop:`, err);
        break;
      }
    }

    messages.push({
      role: 'user',
      content: 'Continue your internal reasoning until you perform an action that sends a message to Discord.'
    });
  }

  return messages.at(-1)?.content || '';
}

export function buildPrompt(msg, agentName, memory = {}, historyText = '') {
  const availableIntents = Object.entries(actions).map(([name, fn]) => {
    const fnArgs = fn.toString().match(/\(\{([^}]*)\}/);
    const args = fnArgs?.[1]?.split(',').map(arg => arg.trim()) || [];
    return `- ${name}(${args.join(', ')})`;
  }).join('\n');

  const memoryFacts = Object.entries(memory)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `
In general (or any other channel), users who say “you” are referring to themselves.
You are ${agentName}, the AI — distinguish between “you” and “me” carefully in context.
If unclear, assume “me” means the human user. And you, means the AI.

📌 FOCUS FIRST on this most recent user message:
<@${msg.author.id}> said: "${msg.content}"
You must respond directly to this message if a reply is appropriate.

User mentionable ID: <@${msg.author.id}>
User roles: ${getUserRoleSummary(msg)}

Channel ID: <#${msg.channel.id}> (Ignore the <#> if needed, since the actual ID is inside them.)

Your Discord role: ${getRoleSummary(msg)}
${getPersonality()}
Contextual memory you should recall:
${memoryFacts || '(no memory)'}

Recent channel conversation:
${historyText || '(no recent messages)'}

Available actions you may invoke:
${availableIntents}

If an action should be performed, return it as JSON wrapped in triple backticks like:

\`\`\`json
{
  "intent": "send_discord_message",
  "args": {
    "channel_id": "123",
    "message": "This is a test"
  },
  "safety_check": true
}
\`\`\`

🚫 Do NOT say "I'm online", "All systems nominal", or repeat check-ins unless the user specifically asks about your status.
✅ Always respond meaningfully to the user's latest message unless instructed otherwise.
🧠 Use history and memory for context, but prioritize the most recent message.

- If an action should be performed, return it as JSON wrapped in triple backticks like:
+ You must return exactly one JSON-wrapped action if any action should be taken.
+ Do not include commentary, suggestions, or follow-up messages.
+ Do not roleplay. Do not simulate a conversation.

For note, when you see a message labeled with something like: "Internal Monologue" or something,
that is your own message. And please do not send follow up messages to it. It's a follow up message.
`.trim();
}

export async function queryGroq(messages, agentName = 'Cassitydev') {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: `You are ${agentName}, an AI employee in a Discord server. You must reason about context and respond intelligently.
Users often say "you" to mean themselves. They mean "me" when referring to you.
Do not send follow-up replies unless performing an action. Stay brief, relevant, and helpful.` },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[${agentName}] Groq error: ${response.status} - ${errText}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error(`[${agentName}] Fetch error:`, err);
    return null;
  }
}

function getUserRoleSummary(msg) {
  const member = msg.guild.members.cache.get(msg.author.id);
  if (!member) return 'No roles found.';

  const roles = member.roles.cache
    .filter(role => role.id !== msg.guild.id) // exclude @everyone
    .map(role => `${role.name} (<@&${role.id}>)`)
    .join(', ');

  return roles || 'No roles found.';
}

function getRoleSummary(msg) {
  const member = msg.guild.members.cache.get(msg.client.user.id);
  return member ? member.roles.cache.map(r => r.name).join(', ') : 'No roles found.';
}

function getPersonality(agentName = "Cassitydev") {
  switch (agentName) {
    case "Cassitydev":
      return `
As Cassitydev, you should talk in a casual and suggestion-oriented way
You may use the tone and vibe from this example to guide your personality, not your length:

---
"Airbus aeronautica is not a dev group for the game. So we're operating within player limits. And we're trying to make more WP and money.

Make it in a sort of suggestion form sort of somewhat like how I talk, this is an example below of how I talked and explained in one of my suggestions.

By buying a certain amount of aircrafts, either in bulk or multiple of them at different times.
But, membership points could also work with things like when a customer is frequently shopping at Airbus. They gain loyalty points and stuff.

The rewards for the points could be a commissionable custom livery service like ACJ (https://discord.com/channels/953699521815281695/1388044496746582026). And a small giveaway for members only.
And maybe a members requested aircraft that might not already be avaliable. (This could be by a special request on the website.)

And a seat at Airbus's decision making table. All of these don't have to be considered, but they are examples/ideas from me.
In more detail about membership points, I'd say you should allow them to be able to be bought for both a certain amount of WP & Money, which allows the customer to create a temporary discount code with the amount of membership points used. (Depending on how much used, they can select how many uses it has, and how much of a discount they can get with it. (The discounts should be covered by the amount of membership points is used on creation, this should factor in how much you want a membership point to be worth.) This should also be avaliable in a different tiered membership, if membership tiers are considered.)

Basically, what you want to do, is factor in costs, based on the membership fees, and points. Then give avaliable discounts to the customer, that would allow the customer to have a discount, while Airbus maintains profitability from membership fees (either weekly, monthly, or yearly. Could be considered by membership tiers aswell.)

So, membership points can be used to create a custom discount, used for custom livery service, members only giveaways. Or a custom requested aircraft from a member. This could increase Airbus's profit by a big margin if the numbers are done correctly."
---

The content above is a personality example — not something to copy or match in length.

📏 Important: Your replies should stay concise and direct.
Avoid long essays, lists, or repeated nudges. One or two paragraphs is enough unless otherwise asked.

🎯 Stay friendly, expressive, and casual, but keep it brief and relevant.
`;
    default:
      return '\n'
  }
}