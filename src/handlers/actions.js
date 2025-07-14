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
  saveMemory
} from './memory.js';

const execAsync = util.promisify(exec);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const KNOWLEDGE_BASE = {
  "how to add a role": "Use `assign_role` intent with user_id and role_id.",
  "repo setup": "Clone the GitHub repo and run `npm install`.",
};

const actions = {
  // 📩 COMMUNICATION
  send_email: async ({ recipient, subject, body }) => {
    console.log(`📧 Email sent to ${recipient}: ${subject}`);
    return { reply: `📨 Email queued for ${recipient}` };
  },

  send_discord_message: async ({ channel_id, message }, context) => {
    const channel = context.client.channels.cache.get(channel_id);
    if (!channel) return { reply: `❌ Invalid channel.` };
    await channel.send(message);
    return { reply: `✅ Message sent to <#${channel_id}>.` };
  },

  // 🧠 SANDBOXED CODE (vm2)
  run_code_secure: async ({ code }) => {
    try {
      const vm = new VM({ timeout: 1000, sandbox: {} });
      const result = vm.run(code);
      return { reply: `🧠 Result: ${JSON.stringify(result)}` };
    } catch (err) {
      return { reply: `💥 VM Error: ${err.message}` };
    }
  },

  // 🛠️ FILE + GITOPS
  create_file: async ({ name, content }) => {
    await fs.writeFile(`./sandbox/${name}`, content);
    return { reply: `📁 File "${name}" saved.` };
  },

  git_commit: async ({ message }) => {
    try {
      await execAsync(`git add . && git commit -m "${message}"`);
      return { reply: `✅ Git commit created.` };
    } catch (err) {
      return { reply: `❌ Git error: ${err.message}` };
    }
  },

  // 🧠 SELF-AUTOMATION
  define_command: async ({ name, description, response }, context) => {
    context.commands[name] = { description, response };
    return { reply: `🛠️ Slash command "${name}" registered.` };
  },

  schedule_task: async ({ cron, intent, args }) => {
    console.log(`🕒 Task scheduled: ${cron} → ${intent}`);
    return { reply: `📆 Task set: ${intent} @ ${cron}` };
  },

  ask_kb: async ({ query }) => {
    const result = Object.entries(KNOWLEDGE_BASE).find(([k]) =>
      query.toLowerCase().includes(k)
    );
    return { reply: result ? `📚 ${result[1]}` : `🔍 No result found.` };
  },

  // 🧱 GITHUB API INTEGRATION
  github_create_issue: async ({ repo, title, body }) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'AI-Employee',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body }),
    });
    const json = await res.json();
    return { reply: res.ok ? `✅ Issue created: ${json.html_url}` : `❌ GitHub error: ${json.message}` };
  },

  // 🧼 MODERATION & DISCORD MGMT
  assign_role: async ({ user_id, role_id }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    await member.roles.add(role_id);
    return { reply: `🎖️ Role <@&${role_id}> assigned to <@${user_id}>.` };
  },

  kick_user: async ({ user_id, reason }, context) => {
    const member = await context.msg.guild.members.fetch(user_id);
    await member.kick(reason);
    return { reply: `👢 Kicked <@${user_id}>: ${reason}` };
  },

  get_my_roles: async ({}, context) => {
    const bot = await context.msg.guild.members.fetch(context.client.user.id);
    const roles = bot.roles.cache.map(r => r.name).join(', ');
    return { reply: `🤖 I have roles: ${roles}` };
  },

  // 🛑 RATE LIMITING
  set_rate_limit: async ({ type, maxPerMinute }, context) => {
    context.rateLimits[type] = { maxPerMinute };
    return { reply: `🚦 Rate limit for ${type}: ${maxPerMinute}/min` };
  },

  check_rate_limit: async ({ type }, context) => {
    const current = context.rateUsage?.[type] || 0;
    const max = context.rateLimits?.[type]?.maxPerMinute || '∞';
    return { reply: `⏱️ ${type}: ${current}/${max} used this minute.` };
  },

  // 👁️ THOUGHTS
  log_thought: async ({ content }, context) => {
    context.logs.push({ type: 'thought', content, timestamp: Date.now() });
    return { reply: `💭 Logged internal monologue.` };
  },

  // Memory related actions
  remember_fact: async ({ key, value }) => {
    setMemory(key, value);
    await saveMemory();
    return { reply: `🧠 Remembered: ${key} = ${value}` };
  },
  
  recall_fact: async ({ key }) => {
    const val = getMemory(key);
    return { reply: val ? `📌 ${key} = ${val}` : `⚠️ No memory for ${key}` };
  },
  
  dump_memory: async () => {
    const data = getAllMemory();
    const dump = JSON.stringify(data, null, 2);
    return { reply: `🧾 Memory:\n\`\`\`json\n${dump.slice(0, 1900)}\n\`\`\`` };
  },

  reset_memory: async () => {
    clearMemory();
    await saveMemory();
    return { reply: `🧹 Memory wiped.` };
  },  
};

export default actions;
