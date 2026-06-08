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

const LEADERBOARD_CHANNEL_ID = '1508588078090948608';
const DEAL_CHANNEL_NAME = 'deal-submissions';

const HYPE_MESSAGES = [
  "LET'S GO! 🔥 Another one in the books!",
  "DEALS ON DEALS! 💰 Keep it coming!",
  "THATS THE MTRO WAY 👑",
  "That's what we're talking about! 🚀",
  "Another day, another deal! 💪",
  "The grind doesn't stop! 🏆",
  "MONEY IN THE BANK! 💵",
  "That's how we do it at MTRO! 🔱",
  "Somebody stop them! 😤",
  "The machine keeps running! ⚙️",
"METRO MOVES DIFFERENT! 🏙️",
"The city is watching! 👀",
"ANOTHER ONE FOR METRO! 💰",
"Built different, paid different! 💵",
"Metro never sleeps! 🌆",
"That's Metro business! 🤝",
"The machine never stops! ⚙️",
"LOCKED IN AND LOCKED OUT! 🔒",
"Champions log deals, losers make excuses! 👑",
"We don't miss at Metro! 🎯",
"Another policy, another step to the top! 🚀",
"METRO ON TOP ALWAYS! 🏆",
"That's what separates us! 💪",
"Easy day for a Metro agent! 😤",
"The scoreboard doesn't lie! 📊"


];

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function getMTMidnight() {
  const now = new Date();
  const mtOffset = -6; // MDT (change to -7 Nov–Mar for MST)
  const mt = new Date(now.getTime() + mtOffset * 60 * 60 * 1000);
  mt.setHours(0, 0, 0, 0);
  return new Date(mt.getTime() - mtOffset * 60 * 60 * 1000).toISOString();
}

function getTodayStart() {
  return getMTMidnight();
}

function getWeekStart() {
  const now = new Date();
  const mtOffset = -6;
  const mt = new Date(now.getTime() + mtOffset * 60 * 60 * 1000);
  const day = mt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  mt.setUTCDate(mt.getUTCDate() + diff);
  mt.setUTCHours(0, 0, 0, 0);
  return new Date(mt.getTime() - mtOffset * 60 * 60 * 1000).toISOString();
}
}

function parseDollars(message) {
  const matches = message.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
  if (!matches) return 0;
  return matches.reduce((sum, m) => sum + parseFloat(m.replace(/[$,]/g, '')), 0);
}

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
  const list = rows.map(([name, amt], i) =>
    `${medals[i] || `${i + 1}.`} **${name}** — $${amt.toLocaleString()}`
  ).join('\n');
  const total = rows.reduce((s, [, a]) => s + a, 0);
  return `${list}\n\n**Total: $${total.toLocaleString()}**`;
}

async function buildLeaderboard() {
  const { data: weekData } = await supabase.from('deals').select('agent_name, amount').gte('created_at', getWeekStart());
  const { data: monthData } = await supabase.from('deals').select('agent_name, amount').gte('created_at', getMonthStart());

  const weekRows = tally(weekData);
  const monthRows = tally(monthData);

  const weekTotal = weekRows.reduce((s, [, a]) => s + a, 0);
  const monthTotal = monthRows.reduce((s, [, a]) => s + a, 0);

  const weekValue = formatRows(weekRows) + `\n\n💼 **Team Total: $${weekTotal.toLocaleString()}**`;
  const monthValue = formatRows(monthRows) + `\n\n💼 **Team Total: $${monthTotal.toLocaleString()}**`;

  return new EmbedBuilder()
    .setTitle('🏆 METRO — Leaderboard')
    .setColor(0xFFD700)
    .addFields(
      { name: '📅 This Week', value: weekValue },
      { name: '📆 This Month', value: monthValue }
    )
    .setTimestamp();
}

async function updateLeaderboard() {
  try {
    const lbChannel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
    const embed = await buildLeaderboard();
    const messages = await lbChannel.messages.fetch({ limit: 20 });
    const botMessage = messages.find(m => m.author.id === client.user.id);
    if (botMessage) {
      await botMessage.edit({ embeds: [embed] });
    } else {
      await lbChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Leaderboard update error:', err);
  }
}

function getMilestoneMessage(amount, mention) {
  if (amount >= 50000) return `🏔️ **$50,000 MTD!!** ${mention} is an ABSOLUTE MONSTER! On that Prime TVL timing! 👑`;
  if (amount >= 40000) return `💎 **$40,000 MTD!** ${mention} is playing a different game! 🔥`;
  if (amount >= 30000) return `🚀 **$30,000 MTD!** ${mention} is on FIRE this month! Keep pushing!`;
  if (amount >= 20000) return `⚡ **$20,000 MTD!** ${mention} is locked in! Half way to legendary!`;
  if (amount >= 10000) return `💰 **$10,000 MTD!** ${mention} just hit five figures! The momentum is REAL!`;
  return null;
}

async function postDailySummary(guild) {
  try {
    const lbChannel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
    const { data: todayData } = await supabase.from('deals').select('agent_name, amount').gte('created_at', getTodayStart());
    const { data: monthData } = await supabase.from('deals').select('agent_name, amount').gte('created_at', getMonthStart());

    const todayRows = tally(todayData);
    const monthRows = tally(monthData);
    const todayTotal = todayRows.reduce((s, [, a]) => s + a, 0);
    const monthTotal = monthRows.reduce((s, [, a]) => s + a, 0);

    const embed = new EmbedBuilder()
      .setTitle('📊 Daily Summary — METRO')
      .setColor(0xFFD700)
      .addFields(
        { name: '☀️ Today\'s Production', value: formatRows(todayRows) || 'No deals today' },
        { name: `Today's Total: $${todayTotal.toLocaleString()}`, value: `Month Total: $${monthTotal.toLocaleString()}` }
      )
      .setTimestamp();

    await lbChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Daily summary error:', err);
  }
}

async function postWeeklyRecap(guild) {
  try {
    const lbChannel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
    const { data: weekData } = await supabase.from('deals').select('agent_name, amount').gte('created_at', getWeekStart());
    const weekRows = tally(weekData);
    const weekTotal = weekRows.reduce((s, [, a]) => s + a, 0);

    const embed = new EmbedBuilder()
      .setTitle('🏁 Weekly Recap — METRO')
      .setColor(0xFFD700)
      .addFields(
        { name: '📅 This Week\'s Rankings', value: formatRows(weekRows) || 'No deals this week' },
        { name: `Week Total`, value: `$${weekTotal.toLocaleString()}` }
      )
      .setTimestamp();

    await lbChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Weekly recap error:', err);
  }
}

function scheduleTasks() {
  setInterval(async () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const utcDay = now.getUTCDay();

    // 12pm MT = 18:00 UTC (MDT) or 19:00 UTC (MST)
    if (utcHour === 18 && utcMin === 0) {
      const guild = client.guilds.cache.first();
      await postDailySummary(guild);
    }

    // 7pm MT = 01:00 UTC next day
    if (utcHour === 1 && utcMin === 0) {
      const guild = client.guilds.cache.first();
      await postDailySummary(guild);
    }

    // Sunday 9pm MT = Monday 03:00 UTC
    if (utcDay === 1 && utcHour === 3 && utcMin === 0) {
      const guild = client.guilds.cache.first();
      await postWeeklyRecap(guild);
    }

   
  }, 60000);
}

client.once('ready', () => {
  console.log(`✅ Metro Man is online and watching!`);
  scheduleTasks();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.name !== DEAL_CHANNEL_NAME) return;

  const amount = parseDollars(message.content);
  if (amount <= 0) return;

  const agentName = message.member?.displayName || message.author.username;
  const mention = `<@${message.author.id}>`;

  const { error } = await supabase.from('deals').insert([{
    agent_name: agentName,
    agent_id: message.author.id,
    amount: amount,
    created_at: new Date().toISOString()
  }]);

  if (error) {
    console.error('Supabase insert error:', error);
    await message.react('❌');
    return;
  }

  console.log(`Logged $${amount} for ${agentName}`);
  await message.react('✅');

  // Hype message
  const hype = HYPE_MESSAGES[Math.floor(Math.random() * HYPE_MESSAGES.length)];
  await message.channel.send(`${mention} ${hype}`);

  // First blood today
  const { data: todayDeals } = await supabase.from('deals').select('id').gte('created_at', getTodayStart());
  if (todayDeals && todayDeals.length === 1) {
    await message.channel.send(`🩸 **FIRST BLOOD!** ${mention} drew first blood today! The hunt is open!`);
  }

  // First strike of the week
  const { data: weekDeals } = await supabase.from('deals').select('id').gte('created_at', getWeekStart());
  if (weekDeals && weekDeals.length === 1) {
    await message.channel.send(`⚔️ **FIRST STRIKE OF THE WEEK!** ${mention} is first on the board! Who's next?`);
  }

  // Personal best + milestones
  const { data: allMonthDeals } = await supabase.from('deals').select('agent_id, amount').gte('created_at', getMonthStart());
  const agentMonthTotal = (allMonthDeals || [])
    .filter(d => d.agent_id === message.author.id)
    .reduce((s, d) => s + d.amount, 0);

  // Check previous best (before this deal)
  const prevTotal = agentMonthTotal - amount;
  const MILESTONES = [10000, 20000, 30000, 40000, 50000];
  for (const milestone of MILESTONES) {
    if (prevTotal < milestone && agentMonthTotal >= milestone) {
      const msg = getMilestoneMessage(milestone, mention);
      if (msg) await message.channel.send(msg);
    }
  }

  await updateLeaderboard();
});

client.login(process.env.DISCORD_TOKEN)