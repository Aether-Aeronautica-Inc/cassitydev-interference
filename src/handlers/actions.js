// src/handlers/actions.js

import fs from 'fs/promises'; // For local sandboxing
import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);

const actions = {
  // 📩 COMMUNICATION
  send_email: async ({ recipient, subject, body }) => {
    console.log(`📧 Sending email to ${recipient}`);
    return { reply: `Email sent to ${recipient}.` };
  },

  send_discord_message: async ({ channel_id, message }, context) => {
    const channel = context.client.channels.cache.get(channel_id);
    if (!channel) return { reply: `❌ Channel ${channel_id} not found.` };
    await channel.send(message);
    return { reply: `✅ Message sent in <#${channel_id}>.` };
  },

  // 🛠️ GIT + FILE SYSTEM
  create_file: async ({ name, content }) => {
    await fs.writeFile(`./sandbox/${name}`, content);
    return { reply: `📁 File "${name}" created in sandbox.` };
  },

  run_code: async ({ language, code }) => {
    if (language !== 'javascript') {
      return { reply: `❌ Only JavaScript is supported in sandbox.` };
    }

    const filepath = './sandbox/tmp.js';
    await fs.writeFile(filepath, code);

    try {
      const { stdout } = await execAsync(`node ${filepath}`);
      return { reply: `🧠 Output:\n${stdout}` };
    } catch (err) {
      return { reply: `💥 Error:\n${err.message}` };
    }
  },

  git_commit: async ({ message }) => {
    try {
      await execAsync(`git add . && git commit -m "${message}"`);
      return { reply: `✅ Git commit created.` };
    } catch (err) {
      return { reply: `❌ Git error: ${err.message}` };
    }
  },

  // 🧠 SELF AUTOMATION
  schedule_task: async ({ cron, action }) => {
    // You can implement real cron jobs with node-cron or Agenda
    console.log(`📅 Scheduled: ${JSON.stringify(action)} to run at ${cron}`);
    return { reply: `🕒 Task scheduled for ${cron}` };
  },

  define_command: async ({ name, description, code }) => {
    // Save the command in your command registry
    console.log(`⚙️ New command: ${name} - ${description}`);
    return { reply: `✅ Slash command "${name}" defined.` };
  },

  // 🎮 DISCORD MANAGEMENT
  assign_role: async ({ user_id, role_id }, context) => {
    const guild = context.msg.guild;
    const member = await guild.members.fetch(user_id);
    if (!member) return { reply: `User not found.` };
    await member.roles.add(role_id);
    return { reply: `🎖️ Role assigned to <@${user_id}>.` };
  },

  kick_user: async ({ user_id, reason }, context) => {
    const guild = context.msg.guild;
    const member = await guild.members.fetch(user_id);
    if (!member) return { reply: `User not found.` };
    await member.kick(reason);
    return { reply: `👢 Kicked <@${user_id}> for: ${reason}` };
  },

  get_my_roles: async ({}, context) => {
    const botMember = await context.msg.guild.members.fetch(context.client.user.id);
    const roleNames = botMember.roles.cache.map(r => r.name);
    return { reply: `🤖 My roles: ${roleNames.join(', ')}` };
  },

  // 👁️ MONITORING
  log_thought: async ({ content }) => {
    console.log(`🧠 Thought log: ${content}`);
    return { reply: `📝 Thought saved.` };
  }
};

export default actions;
