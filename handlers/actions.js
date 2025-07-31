// src/handlers/actions.js

import fs from 'fs/promises';
import { VM } from 'vm2';
import { exec } from 'child_process';
import util from 'util';
import fetch from 'node-fetch';

import {
  getMemory,
  setMemory,
  getAllMemory,
  saveMemory,
} from './memory.js';

const execAsync = util.promisify(exec);

const KNOWLEDGE_BASE = {
  "how to add a role": "Use `assign_role` intent with user_id and role_id.",
  "repo setup": "Clone the GitHub repo and run `npm install`.",
  "how to check user status": "Use `view_user_status` or `is_user_online` intent with user_id.",
  "how to list all server roles": "Use `list_all_roles` intent.",
  "how to get user join date": "Use `get_user_join_date` intent with user_id.",
  "how to contribute to knowledge base": "Use `add_to_kb` with a question and answer.",
  "how to remove a role": "Use `remove_role` intent with user_id and role_id.",
  "how to kick a user": "Use `kick_user` intent with user_id and reason.",
  "how to ban a user": "Use `ban_user` intent with user_id and reason.",
  "how to unban a user": "Use `unban_user` with user_id or tag.",
  "how to check user status": "Use `view_user_status` or `is_user_online` intent with user_id.",
  "how to get user join date": "Use `get_user_join_date` intent with user_id.",
  "how to set a nickname": "Use `set_nickname` with user_id and nickname.",
  "how to send a DM": "Use `dm_user` with user_id and message.",
  "how to list all server roles": "Use `list_all_roles` intent.",
  "how to list all channels": "Use `list_channels` intent.",
  "how to check permissions": "Use `check_bot_permissions` intent.",
  "how to contribute to knowledge base": "Use `add_to_kb` with a question and answer.",
  "how to get channel info": "Use `get_channel_info` intent with channel_id.",
  "how to fetch channel history": "Use `get_channel_history` intent with channel_id and optional limit.",
  "how to find a channel by name": "Use `find_channel_by_name` intent with name to get its ID and metadata.",
};

const actions = {
  // 📩 COMMUNICATION
  send_discord_message: async ({ channel_id, message }, context) => {
    const channel = context.client.channels.cache.get(channel_id);
    if (!channel) return { reply: `❌ Invalid channel.`, code: 1 };
    await channel.send(message);
    return { reply: `✅ Message sent to <#${channel_id}>.`, code: 0 };
  },

  // 🔍 Get all roles in the server
  list_all_roles: async ({}, context) => {
    const roles = context.msg.guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => `<@&${role.id}> (${role.name})`)
      .join('\n');

    return {
      reply: roles ? `📜 Server Roles:\n${roles}` : '⚠️ No roles found.', code: 0
    };
  },

  // 🔎 Search for a channel by name
  find_channel_by_name: async ({ name }, context) => {
    const match = context.msg.guild.channels.cache.find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );

    if (!match) {
      return { reply: `❌ No channel found with name "${name}".`, code: 1 };
    }

    return {
      reply: `🔎 Found channel:
  • Name: ${match.name}
  • Mention: <#${match.id}>
  • ID: ${match.id}
  • Topic: ${match.topic || 'No topic'}
  • Type: ${match.type}`,
      code: 0
    };
  },

  // 🧼 Remove a role
  remove_role: async ({ user_id, role_id }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    await member.roles.remove(role_id);
    return { reply: `🗑️ Role <@&${role_id}> removed from <@${user_id}>.` };
  },

  // 🔨 Ban a user
  ban_user: async ({ user_id, reason = 'No reason provided' }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    await member.ban({ reason });
    return { reply: `⛔ Banned <@${user_id}>: ${reason}`, code: 0 };
  },

  // 🔓 Unban a user
  unban_user: async ({ user_id }, context) => {
    try {
      await context.msg.guild.bans.remove(user_id);
      return { reply: `✅ Unbanned <@${user_id}>.`, code: 0 };
    } catch (err) {
      return { reply: `❌ Could not unban <@${user_id}>: ${err.message}`, code: 1 };
    }
  },

  // 📝 Set nickname
  set_nickname: async ({ user_id, nickname }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    await member.setNickname(nickname);
    return { reply: `✏️ Nickname for <@${user_id}> set to "${nickname}".`, code: 0 };
  },

  // 📬 DM a user
  dm_user: async ({ user_id, message }, context) => {
    try {
      const user = await context.client.users.fetch(user_id);
      await user.send(message);
      return { reply: `📨 DM sent to <@${user_id}>.`, code: 0 };
    } catch (err) {
      return { reply: `❌ Could not DM <@${user_id}>: ${err.message}`, code: 1 };
    }
  },

  // 📡 List all channels
  list_channels: async ({}, context) => {
    const channels = context.msg.guild.channels.cache
      .filter(c => c.isTextBased())
      .map(c => `• ${c.name} (<#${c.id}>)`)
      .join('\n');

    return {
      reply: channels ? `📺 Channels:\n${channels}` : '⚠️ No channels found.', code: 0
    };
  },

  // 👥 List online members
  list_online_members: async ({}, context) => {
    const members = await context.msg.guild.members.fetch({ withPresences: true });
    const online = members.filter(m => m.presence?.status === 'online');

    const list = online.map(m => `<@${m.id}>`).join(', ');
    return {
      reply: list ? `🟢 Online members: ${list}` : `🔴 No members currently online.`, code: 0
    };
  },

  // 🛡️ Check bot permissions
  check_bot_permissions: async ({}, context) => {
    const bot = await context.msg.guild.members.fetch(context.client.user.id);
    const perms = bot.permissions.toArray();
    return {
      reply: `🛡️ My permissions: ${perms.join(', ')}`, code: 0
    };
  },

  // 👤 Get user join date
  get_user_join_date: async ({ user_id }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    const joinedAt = member.joinedAt?.toLocaleString() || 'Unknown';
    return { reply: `📅 <@${user_id}> joined on **${joinedAt}**.`, code: 0 };
  },

  // 🌐 Check if user is online
  is_user_online: async ({ user_id }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    const status = member?.presence?.status || 'offline';
    return {
      reply: status === 'offline'
        ? `🔴 <@${user_id}> is currently offline.`
        : `🟢 <@${user_id}> is **${status}**.`, code: 0
    };
  },

  // 🧠 Knowledge: List known topics
  list_kb_topics: async () => {
    const topics = Object.keys(KNOWLEDGE_BASE).map(t => `• ${t}`).join('\n');
    return {
      reply: topics ? `📚 Known topics:\n${topics}` : 'ℹ️ Knowledge base is empty.', code: 0
    };
  },

  // ➕ Knowledge: Add topic to knowledge base
  add_to_kb: async ({ question, answer }) => {
    KNOWLEDGE_BASE[question.toLowerCase()] = answer;
    return { reply: `✅ Added to knowledge base: "${question}" → "${answer}"`, code: 0 };
  },

  // 🧠 SANDBOXED CODE (vm2)
  run_code_secure: async ({ code }) => {
    try {
      const vm = new VM({ timeout: 1000, sandbox: {} });
      const result = vm.run(code);
      return { reply: `🧠 Result: ${JSON.stringify(result)}`, code: 0 };
    } catch (err) {
      return { reply: `💥 VM Error: ${err.message}`, code: 1 };
    }
  },

  // 🛠️ FILE + GITOPS
  create_file: async ({ name, content }) => {
    try {
      // Ensure sandbox directory exists
      await fs.mkdir('./sandbox', { recursive: true });
      await fs.writeFile(`./sandbox/${name}`, content);
      return { reply: `📁 File "${name}" saved.`, code: 0 };
    } catch (err) {
      return { reply: `💥 File creation error: ${err.message}`, code: 1 };
    }
  },

  get_file_contents: async ({ name, start_section, end_section }) => {
    try {
      const contents = (await fs.readFile(`./sandbox/${name}`)).toString();
      const sliced = start_section || end_section ? contents.slice(start_section || 0, end_section) : contents;
      return { reply: `📁 File "${name}" contents: \n\`\`\`\n${sliced.slice(0, 1900)}\n\`\`\``, code: 0 };
    } catch (err) {
      return { reply: `💥 File read error: ${err.message}`, code: 1 };
    }
  },

  git_commit: async ({ message }, context) => {
    try {
      const gitName = process.env[`GITHUB_NAME`];
      const gitEmail = process.env[`GITHUB_EMAIL`];
  
      await execAsync(`git config user.name "${gitName}"`);
      await execAsync(`git config user.email "${gitEmail}"`);
  
      await execAsync(`git add .`);
      await execAsync(`git commit -m "${message}"`);
  
      return { reply: `✅ Commit by ${gitName} created.`, code: 0 };
    } catch (err) {
      return { reply: `❌ Git error: ${err.message}`, code: 1 };
    }
  },

  git_push: async ({ branch = 'main' }, context) => {
    try {
      await execAsync(`git push origin ${branch}`);
      return { reply: `🚀 Pushed to ${branch}.`, code: 0 };
    } catch (err) {
      return { reply: `❌ Push failed: ${err.message}`, code: 1 };
    }
  },  

  // 🧠 SELF-AUTOMATION
  define_command: async ({ name, description, response }, context) => {
    context.commands[name] = { description, response };
    return { reply: `🛠️ Slash command "${name}" registered.`, code: 0 };
  },

  schedule_task: async ({ cron, intent, args }) => {
    console.log(`🕒 Task scheduled: ${cron} → ${intent}`);
    return { reply: `📆 Task set: ${intent} @ ${cron}`, code: 0 };
  },

  ask_kb: async ({ query }) => {
    const result = Object.entries(KNOWLEDGE_BASE).find(([k]) =>
      query.toLowerCase().includes(k)
    );
    return { reply: result ? `📚 ${result[1]}` : `🔍 No result found.`, code: 0 };
  },

  // 🧱 GITHUB API INTEGRATION
  github_create_issue: async ({ repo, title, body }, context) => {
    const tokenEnvKey = `GITHUB_TOKEN`;
    const token = process.env[tokenEnvKey];
  
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'AI-Employee',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body }),
    });
  
    const json = await res.json();
    return {
      reply: res.ok
        ? `✅ Issue created: ${json.html_url}`
        : `❌ GitHub error: ${json.message}`,
      code: res.ok
        ? 0
        : 1,
    };
  },
  
  whoami_github: async ({}, context) => {
    const tokenEnvKey = `GITHUB_TOKEN_BOT`;
    const token = process.env[tokenEnvKey];
  
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'AI-Employee',
      }
    });
  
    const json = await res.json();
    return {
      reply: res.ok
        ? `👤 GitHub user: ${json.login}`
        : `❌ Failed to get GitHub user: ${json.message}`,
      code: res.ok
        ? 0
        : 1,
    };
  },  

  // 🧼 MODERATION & DISCORD MGMT
  assign_role: async ({ user_id, role_id }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    await member.roles.add(role_id);
    return { reply: `🎖️ Role <@&${role_id}> assigned to <@${user_id}>.`, code: 0 };
  },

  kick_user: async ({ user_id, reason }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    await member.kick(reason);
    return { reply: `👢 Kicked <@${user_id}>: ${reason}`, code: 0 };
  },

  // Discord related actions
  view_user_status: async ({ user_id }, context) => {
    try {
      const member = await context.msg.guild.members.fetch(user_id);
      const presence = member.presence?.status || 'offline';
      return { reply: `🟢 <@${user_id}> is currently **${presence}**.`, code: 0 };
    } catch (err) {
      return { reply: `❌ Couldn't fetch status for <@${user_id}>.`, code: 1 };
    }
  },
  
  check_if_bod: async ({ user_id }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    const isBoD = member.roles.cache.some(role => /bod|board of directors/i.test(role.name));
    return {
      reply: isBoD ? `🧑‍💼 <@${user_id}> is a **Board of Directors** member.` : `👤 <@${user_id}> is not part of the BoD.`, code: 0
    };
  },
  
  view_user_bio: async ({ user_id }, context) => {
    try {
      const user = await context.client.users.fetch(user_id);
      const bio = user.bio || user.globalName || 'No bio available.';
      return { reply: `📋 Bio of <@${user_id}>: ${bio}`, code: 0 };
    } catch (err) {
      return { reply: `❌ Couldn't fetch bio for <@${user_id}>.`, code: 1 };
    }
  },

  // 📜 Get channel topic and metadata
  get_channel_info: async ({ channel_id }, context) => {
    const channel = context.client.channels.cache.get(channel_id);
    if (!channel || !channel.isTextBased()) {
      return { reply: `❌ Invalid or non-text channel.`, code: 1 };
    }

    return {
      reply: `📘 Channel Info for <#${channel_id}>:
  • Name: ${channel.name}
  • ID: ${channel.id}
  • Type: ${channel.type}
  • Topic: ${channel.topic || 'No topic set'}
  • NSFW: ${channel.nsfw ? 'Yes' : 'No'}
  • Rate Limit: ${channel.rateLimitPerUser || 0}s
  • Created At: ${channel.createdAt.toLocaleString()}
      `,
      code: 0
    };
  },

  // 🕓 Fetch recent message history from a channel
  get_channel_history: async ({ channel_id, limit = 10 }, context) => {
    try {
      const channel = context.client.channels.cache.get(channel_id);
      if (!channel || !channel.isTextBased()) {
        return { reply: `❌ Invalid or non-text channel.`, code: 1 };
      }

      const messages = await channel.messages.fetch({ limit });
      const history = Array.from(messages.values())
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`)
        .join('\n');

      return {
        reply: history
          ? `📜 Last ${limit} messages in <#${channel_id}>:\n\`\`\`\n${history.slice(0, 1900)}\n\`\`\``
          : '📭 No messages found.',
        code: 0
      };
    } catch (err) {
      return { reply: `❌ Error fetching history: ${err.message}`, code: 1 };
    }
  },

  // 👁️ THOUGHTS
  log_thought: async ({ content }, context) => {
    context.logs.push({ type: 'thought', content, timestamp: Date.now() });
    return { reply: `💭 Logged internal monologue.`, code: 0 };
  },

  // Memory related actions
  remember_fact: async ({ key, value }, context) => {
    try {
      setMemory(key, value, 'Cassitydev');
      await saveMemory();
      return { reply: `🧠 Remembered: ${key} = ${value}`, code: 0 };
    } catch (err) {
      return { reply: `❌ Memory error: ${err.message}`, code: 1 };
    }
  },
  
  recall_fact: async ({ key }) => {
    try {
      const val = getMemory(key, 'Cassitydev');
      const content = val?.content || val;
      return { reply: content ? `📌 ${key} = ${content}` : `⚠️ No memory for ${key}`, code: 0 };
    } catch (err) {
      return { reply: `❌ Recall error: ${err.message}`, code: 1 };
    }
  },
  
  dump_memory: async () => {
    try {
      const data = getAllMemory('Cassitydev');
      const dump = JSON.stringify(data, null, 2);
      return { reply: `🧾 Memory:\n\`\`\`json\n${dump.slice(0, 1900)}\n\`\`\``, code: 0 };
    } catch (err) {
      return { reply: `❌ Memory dump error: ${err.message}`, code: 1 };
    }
  },

  reset_memory: async () => {
    try {
      clearMemory('Cassitydev');
      await saveMemory();
      return { reply: `🧹 Memory wiped.`, code: 0 };
    } catch (err) {
      return { reply: `❌ Memory reset error: ${err.message}`, code: 1 };
    }
  },

  add_memory_entry: async ({ key, value }, context) => {
    try {
      setMemory(key, value, 'Cassitydev');
      await saveMemory();
      return { reply: `🧠 Noted: ${key} = ${value}`, code: 0 };
    } catch (err) {
      return { reply: `❌ Memory entry error: ${err.message}`, code: 1 };
    }
  },

  // End monologue - critical for stopping the internal monologue loop
  end_monologue: async ({ reason = 'Task completed' }, context) => {
    console.log(`[${context.agentName || 'Agent'}] Ending monologue: ${reason}`);
    return { reply: `✅ Monologue ended: ${reason}`, code: 7 };
  },

  // Debug action for checking system status
  system_status: async ({}, context) => {
    try {
      const memoryCount = Object.keys(getAllMemory('Cassitydev')).length;
      const uptime = process.uptime();
      return {
        reply: `🔧 System Status:
• Memory entries: ${memoryCount}
• Uptime: ${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s
• Node version: ${process.version}
• Platform: ${process.platform}`,
        code: 0
      };
    } catch (err) {
      return { reply: `❌ Status check error: ${err.message}`, code: 1 };
    }
  }
};

export default actions;
