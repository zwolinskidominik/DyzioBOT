/**
 * Test script: generates Server Wrapped image and sends it to the monthly-stats channel.
 * Usage: npx tsx src/scripts/testWrapped.ts
 */
import { Client, GatewayIntentBits, TextChannel, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { collectWrappedData, renderWrappedCanvas } from '../services/serverWrappedService';
import { WrappedConfigModel } from '../models/WrappedConfig';

dotenv.config();

const GUILD_ID = process.argv[2] || '881293681783623680';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', async () => {
  try {
    console.log(`✅ Bot zalogowany jako ${client.user?.tag}`);
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Połączono z bazą');

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error(`❌ Nie znaleziono serwera ${GUILD_ID}`);
      process.exit(1);
    }

    console.log(`📊 Zbieram dane dla "${guild.name}"...`);
    const data = await collectWrappedData(guild);
    console.log('Dane:', {
      members: data.memberCount,
      messages: data.totalMessages,
      voiceHours: data.totalVoiceHours,
      giveaways: data.totalGiveaways,
      wordle: data.totalWordleGames,
      invites: data.totalInvites,
      topMsg: data.topMessages.map((u) => `${u.displayName}: ${u.value}`),
      topVc: data.topVoice.map((u) => `${u.displayName}: ${u.value}`),
      topLvl: data.topLevel.map((u) => `${u.displayName}: ${u.value}`),
    });

    console.log('🎨 Renderuję canvas...');
    const imageBuffer = await renderWrappedCanvas(data);
    console.log(`✅ Obraz wygenerowany (${(imageBuffer.length / 1024).toFixed(0)} KB)`);

    // Find channel
    const wrappedConfig = await WrappedConfigModel.findOne({
      guildId: guild.id,
      enabled: true,
    }).lean();

    if (!wrappedConfig?.channelId) {
      console.log('⚠️ Brak skonfigurowanego kanału — zapisuję lokalnie jako wrapped-test.png');
      const fs = await import('fs');
      fs.writeFileSync('wrapped-test.png', imageBuffer);
      console.log('✅ Zapisano wrapped-test.png');
    } else {
      const channel = guild.channels.cache.get(wrappedConfig.channelId) as TextChannel | undefined;
      if (!channel?.send) {
        console.error('❌ Nie mogę wysłać na kanał', wrappedConfig.channelId);
      } else {
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'server-wrapped.png' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('wrapped:personal')
            .setLabel('🎁 TWOJE WRAPPED!')
            .setStyle(ButtonStyle.Primary),
        );

        await channel.send({
          content: `# 🧪 Test Server Wrapped\nPodgląd testowy — tak będzie wyglądało podsumowanie na urodziny serwera!`,
          files: [attachment],
          components: [row],
        });
        console.log(`✅ Wysłano na #${channel.name}`);
      }
    }
  } catch (err) {
    console.error('❌ Błąd:', err);
  } finally {
    await mongoose.disconnect();
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.TOKEN);
