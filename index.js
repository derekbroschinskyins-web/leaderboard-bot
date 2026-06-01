const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// — Date Helpers —
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// — Parse dollar amounts —
function parseDollars(message) {
  const matches = message.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
  if (!matches) return 0;
  return matches.reduce((sum, m) => {
    return sum + parseFloat(m.replace(/[$,]/g, ''));
  }, 0);
}

// — Build leaderboard embed —
async function buildLeaderboard() {
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  const { data: weekData } = await supabase
    .from('deals')
    .select('agent_name, amount')
    .gte('created_at', weekStart);

  const { data: monthData } = await supabase
    .from('deals')
    .select('agent_name, amount')
    .gte('created_at', monthStart);

  function tally(data) {
    const map = {};
    for (const row of data || []) {
      map[row.agent_name] = (map[row.agent_name] || 0) + row.amount;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function formatRows(rows) {
    if (rows.length === 0) return 'No deals yet';
    const medals = ['🥇', '🥈', '🥉'];
    return rows.map(([name, amt], i) => {
      const medal = medals[i] || `${i + 1}.`;
      return `${medal} **${name}** — $${amt.toLocaleString()}`;
    }).join('\n');
  }

  const weekRows = tally(weekData);
  const monthRows = tally(monthData);

  const embed = new EmbedBuilder()
    .setTitle('🏆 TOP ONE PERCENT — Leaderboard')
    .setColor(0xFFD700)
    .addFields(
      { name: '📅 This Week', value: formatRows(weekRows) },
      { name: '📆 This Month', value: formatRows(monthRows) }
    )
    .setTimestamp();

  return embed;
}

// — Auto reset —
function scheduleResets() {
  setInterval(async () => {
    const now = new Date();
    // Sunday midnight Mountain Time (UTC-6 or UTC-7)
    const isSunday = now.getUTCDay() === 1; // Monday UTC = Sunday midnight MT
    const isMidnight = now.getUTCHours() === 6 && now.getUTCMinutes() === 0;
    const isFirstOfMonth = now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0;

    if (isSunday && isMidnight) {
      await supabase.from('deals').delete().gte('created_at', getWeekStart());
      console.log('Weekly reset done');
    }
    if (isFirstOfMonth) {
      await supabase.from('deals').delete().gte('created_at', getMonthStart());
      console.log('Monthly reset done');
    }
  }, 60000);
}

client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}`);
  scheduleResets();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.name !== 'deal-submissions') return;

  const amount = parseDollars(message.content);
  if (amount <= 0) return;

  const agentName = message.member?.displayName || message.author.username;

  await supabase.from('deals').insert([{
    agent_name: agentName,
    amount: amount,
    created_at: new Date().toISOString()
  }]);

  const embed = await buildLeaderboard();

  // Find leaderboard channel and update
  const lbChannel = await message.guild.channels.fetch('1508588078090948608');
  if (!lbChannel) return;

  const messages = await lbChannel.messages.fetch({ limit: 10 });
  const botMessage = messages.find(m => m.author.id === client.user.id);

  if (botMessage) {
    await botMessage.edit({ embeds: [embed] });
  } else {
    await lbChannel.send({ embeds: [embed] });
  }

  await message.react('✅');
});

client.login(process.env.DISCORD_TOKEN);