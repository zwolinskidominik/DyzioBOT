import dotenv from 'dotenv'; dotenv.config();
import { Client, GatewayIntentBits, TextChannel, AttachmentBuilder } from 'discord.js';
import mongoose from 'mongoose';
import { collectPersonalWrappedData, renderPersonalWrappedCanvas } from '../services/serverWrappedService';

const GUILD_ID = process.argv[2] || '1264582308003053570';
const USER_ID = process.argv[3] || '495924515623206913';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('ready', async () => {
  try {
    console.log('✅ Bot:', client.user?.tag);
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ DB connected');

    const guild = client.guilds.cache.get(GUILD_ID)!;
    const member = await guild.members.fetch(USER_ID);
    console.log('👤 Member:', member.displayName);

    const data = await collectPersonalWrappedData(member);
    console.log('Data:', {
      messages: data.totalMessages,
      voiceMin: data.totalVoiceMinutes,
      level: data.level,
      wordle: `${data.wordleWins}W/${data.wordleLosses}L`,
      giveaways: data.giveawaysEntered,
      invites: data.invites,
      ranks: `msg#${data.messageRank} vc#${data.voiceRank} lvl#${data.levelRank}`,
      topMonth: data.topMonth,
    });

    const buf = await renderPersonalWrappedCanvas(data);
    console.log(`✅ Image: ${(buf.length / 1024).toFixed(0)} KB`);

    const ch = guild.channels.cache.find(c => c.isTextBased()) as TextChannel | undefined;
    if (ch) {
      await ch.send({
        content: '🧪 Test personal wrapped',
        files: [new AttachmentBuilder(buf, { name: 'wrapped.png' })],
      });
      console.log(`✅ Sent to #${ch.name}`);
    }
  } catch (err) {
    console.error('❌', err);
  } finally {
    await mongoose.disconnect();
    client.destroy();
    process.exit(0);
  }
});
client.login(process.env.TOKEN);
