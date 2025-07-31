import { executeIntent } from './executor.js';
import actions from './actions.js';
import fetch from 'node-fetch';
import { getAgentMessages, appendToAgentMessages } from '../agents/state.js';

function trimMessagesToFitContext(messages, maxTokens = 1200) {
  let totalTokens = 0;
  const trimmed = [];
  
  // Always preserve the first system message if it exists
  const systemMessage = messages.find(m => m.role === 'system');
  if (systemMessage) {
    trimmed.push(systemMessage);
    totalTokens += Math.ceil(systemMessage.content.length / 3);
  }

  // Add other messages from most recent, but skip system messages as they're already added
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'system') continue; // Skip system messages, already added
    
    const estimatedTokens = Math.ceil(msg.content.length / 3);
    if (totalTokens + estimatedTokens > maxTokens) break;
    trimmed.push(msg); // Add to end since we want recent messages
    totalTokens += estimatedTokens;
  }

  // Sort to put system message first, then chronological order for others
  return trimmed.sort((a, b) => {
    if (a.role === 'system') return -1;
    if (b.role === 'system') return 1;
    return 0;
  });
}

export async function runInternalMonologueLoop(agentName, msg, client) {
  let loopCount = 0;
  let errorCount = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  const agentMessages = getAgentMessages(agentName);

  while (true) { // Infinite loop as requested
    const trimmedMessages = trimMessagesToFitContext(agentMessages, 1000); // Further reduced for GPT-2
    
    // Debug: Log what messages we're sending to the AI
    console.log(`[${agentName}] Sending ${trimmedMessages.length} messages to AI:`);
    trimmedMessages.forEach((msg, i) => {
      console.log(`  ${i}: ${msg.role} - ${msg.content.substring(0, 100)}...`);
    });
    
    const aiReply = await query(trimmedMessages, agentName);
    
    // Handle errors but don't break the infinite loop
    if (!aiReply || aiReply.includes('Unable to connect to AI model') || aiReply.includes('Prompt is too long')) {
      consecutiveErrors++;
      console.log(`[${agentName}] AI Error (consecutive: ${consecutiveErrors}): ${aiReply}`);
      
      // If too many consecutive errors, take recovery actions
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.log(`[${agentName}] Taking recovery actions due to consecutive errors`);
        
        // Clear most of the conversation history but keep system message
        if (agentMessages.length > 2) {
          const systemMsg = agentMessages[0]; // Keep system message
          agentMessages.length = 0; // Clear all messages
          agentMessages.push(systemMsg); // Re-add system message
          console.log(`[${agentName}] Cleared conversation history for recovery`);
        }
        
        // Add a recovery message
        appendToAgentMessages(agentName, {
          role: 'assistant',
          content: `[System Recovery] Cleared context after ${consecutiveErrors} consecutive errors. Resuming operations.`
        });
        
        consecutiveErrors = 0; // Reset consecutive error counter
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for recovery
        continue;
      }
      
      // For fewer consecutive errors, just wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000 * consecutiveErrors)); // Exponential backoff
      continue;
    }
    
    // Reset error counts on successful response
    errorCount = 0;
    consecutiveErrors = 0;
    loopCount++;
    
    // Debug: log the AI response to see what it's generating
    console.log(`[${agentName}] AI Response ${loopCount}: ${aiReply.substring(0, 200)}...`);
    
    appendToAgentMessages(agentName, {
      role: 'assistant',
      content: `[Internal Monologue ${loopCount}] ${aiReply}`
    });

    const match = aiReply.match(/```json([\s\S]+?)```/);
    if (match) {
      console.log(`[${agentName}] Found JSON action: ${match[1]}`);
    } else {
      console.log(`[${agentName}] No JSON action found in response`);
    }
    
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
        console.log(`[${agentName}] Intent parsing error, continuing loop: ${err.message}`);
        // Don't break the infinite loop, just continue
      }
    }

    appendToAgentMessages(agentName, {
      role: 'user',
      content: 'Continue your internal reasoning until you perform a conclusive action.'
    });
  }

  // Return last AI response in context (if any)
  const last = [...agentMessages].reverse().find(m => m.role === 'assistant');
  return last?.content || 'Monologue completed after error recovery.';
}

export function buildPrompt(msg, agentName, memoryEntries = [], historyText = '') {
  const userMessage = msg.content;
  const channelId = msg.channel.id;
  const personality = getPersonality(agentName);

  return `You are ${agentName}, an AI assistant capable of:
${personality}

🛠️ **Available Actions**:
- send_discord_message(channel_id, message) - Send messages to Discord
- create_file(name, content) - Create files in sandbox
- get_file_contents(name) - Read files from sandbox
- run_code_secure(code) - Execute JavaScript code safely
- remember_fact(key, value) - Store information in memory
- recall_fact(key) - Retrieve stored information
- github_create_issue(repo, title, body) - Create GitHub issues
- system_status() - Check system health
- ask_kb(query) - Query knowledge base
- list_all_roles() - List Discord server roles
- find_channel_by_name(name) - Find Discord channel by name
- get_channel_info(channel_id) - Get channel information
- get_channel_history(channel_id, limit) - Get message history
- end_monologue() - End internal reasoning

📋 **Current Context**:
User message: "${userMessage}" (Channel: ${channelId})

📜 **Recent Conversation**:
${historyText || '(no recent activity)'}

🧠 **Your Memory**:
${memoryEntries.length > 0 ? memoryEntries.join('\n') : '(no stored memories)'}

💭 **Decision Process**:
1. **Analyze**: What does this situation require? Is it a question, task, casual chat, or command?
2. **Context**: What relevant information do I have from memory or conversation history?
3. **Action**: What specific action should I take to be helpful?

🎯 **Response Guidelines**:
- Only respond if the message needs your attention (questions, commands, mentions)
- Use your personality - be casual, direct, and helpful
- Don't respond to conversations between other users unless relevant
- If you need to respond, be concise and actionable

**Use JSON format for all actions**:

To send a message:
\`\`\`json
{"intent": "send_discord_message", "args": {"channel_id": "${channelId}", "message": "your response"}, "safety_check": true}
\`\`\`

To create a file:
\`\`\`json
{"intent": "create_file", "args": {"name": "filename.ext", "content": "file content"}, "safety_check": true}
\`\`\`

To end reasoning (when no action needed):
\`\`\`json
{"intent": "end_monologue", "args": {}, "safety_check": true}
\`\`\`
`;
}

export async function query(messages, agentName = 'Cassitydev') {
  try {
    const response = await fetch('http://localhost:11434/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000, // 30 second timeout
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      console.error(`[${agentName}] AI API returned ${response.status}: ${response.statusText}`);
      return `Unable to connect to AI model (HTTP ${response.status}). Please check if the local AI server is running.`;
    }

    const data = await response.json();
    console.log(`[${agentName}] Received from AI server: ${JSON.stringify(data)}`);
    const aiResponse = data.response ?? 'No response received from AI model.';
    console.log(`[${agentName}] AI response length: ${aiResponse.length}`);
    return aiResponse;
  } catch (err) {
    console.error(`[${agentName}] Local AI Error:`, err.message);
    if (err.code === 'ECONNREFUSED') {
      return 'AI model server is not running. Please start the local AI server on port 11434.';
    }
    return `AI model error: ${err.message}`;
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

export function getPersonality(agentName = 'Cassitydev') {
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
  } else return '';
}
