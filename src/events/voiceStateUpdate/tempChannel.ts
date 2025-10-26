import {
  VoiceState,
  ChannelType,
  GuildChannel,
  VoiceChannel,
  GuildChannelCreateOptions,
  GuildChannelTypes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { TempChannelModel } from '../../models/TempChannel';
import { TempChannelConfigurationModel } from '../../models/TempChannelConfiguration';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export default async function run(oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    const monitoredChannelIds = await getMonitoredChannels(newState.guild.id);

    if (isJoiningMonitoredChannel(oldState, newState, monitoredChannelIds)) {
      const newChannel = await createTemporaryChannel(newState);

      const tempChannelDoc = await saveTemporaryChannel(newState, newChannel);

      await sendControlPanel(newChannel, tempChannelDoc);

      await moveUserToChannel(newState, newChannel);
    }
    
    // Sprawdź czy użytkownik dołącza do istniejącego tymczasowego kanału
    if (newState.channel && newState.channelId !== oldState.channelId) {
      const tempChannel = await TempChannelModel.findOne({
        channelId: newState.channelId,
      });
      
      // Jeśli to tymczasowy kanał, daj użytkownikowi uprawnienia do czytania czatu
      if (tempChannel && newState.member && newState.channel instanceof VoiceChannel) {
        await newState.channel.permissionOverwrites.edit(newState.member.id, {
          ReadMessageHistory: true,
          ViewChannel: true,
          SendMessages: true,
        });
      }
    }

    await cleanupEmptyTempChannel(oldState);
  } catch (error: unknown) {
    const msg = error instanceof Error ? (error.stack ?? error.message) : String(error);
    logger.error(`Błąd podczas obsługi voiceStateUpdate: ${msg}`);
  }
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  attempts = 2,
  delayMs = 1_000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`Próba ${i + 1} nie powiodła się: ${msg}. Ponawiam za ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

function removeUndefinedFields<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
}

function isVoiceChannel(channel: GuildChannel): channel is VoiceChannel {
  return channel.type === ChannelType.GuildVoice;
}

async function getMonitoredChannels(guildId: string): Promise<string[]> {
  const monitoredChannels = await TempChannelConfigurationModel.find({ guildId });
  return monitoredChannels.map((config) => config.channelId);
}

async function createTemporaryChannel(newState: VoiceState): Promise<VoiceChannel> {
  const guild = newState.guild;
  const parentChannel = (newState.channel as GuildChannel)?.parent;

  if (!guild || !guild.channels) {
    throw new Error('Guild lub guild.channels jest undefined.');
  }

  // Nazwa kanału: "Kanał - NickUżytkownika"
  const channelName = newState.member 
    ? `Kanał - ${newState.member.displayName}`
    : `Tymczasowy kanał`;

  // Tworzymy kanał z PUSTYMI permission overwrites - nie dziedziczymy z oryginału
  const channelOptions: GuildChannelCreateOptions & { type: GuildChannelTypes } = {
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: parentChannel,
    userLimit: newState.channel?.userLimit,
    permissionOverwrites: [], // Pusta tablica - zamiast kopiować z oryginalnego kanału
  };

  const filteredOptions = removeUndefinedFields(channelOptions);
  const finalOptions: GuildChannelCreateOptions & { type: GuildChannelTypes } = {
    ...filteredOptions,
    type: ChannelType.GuildVoice,
    name: channelName,
  };

  return await retryOperation<VoiceChannel>(
    async () => {
      const channel = await guild.channels.create(finalOptions);
      if (!isVoiceChannel(channel)) {
        throw new Error('Utworzony kanał nie jest kanałem głosowym');
      }
      
      // NIE ustawiamy explicit permissions - kanał dziedziczy z kategorii
      // To pozwala zachować wszystkie skonfigurowane role
      
      // Tylko właściciel dostaje specjalne uprawnienia
      if (newState.member) {
        await channel.permissionOverwrites.edit(newState.member.id, {
          Connect: true,
          Speak: true,
          Stream: true,
          MuteMembers: true,
          DeafenMembers: true,
          MoveMembers: true,
        });
      }
      
      return channel;
    },
    3,
    1000
  );
}

async function saveTemporaryChannel(newState: VoiceState, newChannel: VoiceChannel): Promise<any> {
  const guild = newState.guild;
  const parentChannel = (newState.channel as GuildChannel)?.parent;

  const tempChannel = new TempChannelModel({
    guildId: guild.id,
    parentId: parentChannel?.id,
    channelId: newChannel.id,
    ownerId: newState.member?.id,
  });

  await tempChannel.save();
  return tempChannel;
}

async function sendControlPanel(channel: VoiceChannel, tempChannelDoc: any): Promise<void> {
  try {
    const embed = createBaseEmbed({
      title: '⚙️ Panel zarządzania kanałem',
      description: `<@${tempChannelDoc.ownerId}> - Witaj na swoim tymczasowym kanale!`,
      timestamp: false,
    }).setFooter({ text: 'Użyj przycisków poniżej, aby zarządzać tym kanałem głosowym' });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('voice_limit')
        .setLabel('Limit')
        .setEmoji('🔢')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('voice_name')
        .setLabel('Nazwa')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('voice_lock')
        .setLabel('Lock')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('voice_kick')
        .setLabel('Kick')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Danger)
    );

    const buttons2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('voice_transfer')
        .setLabel('Transfer')
        .setEmoji('👑')
        .setStyle(ButtonStyle.Success)
    );

    const message = await channel.send({
      content: `<@${tempChannelDoc.ownerId}>`,
      embeds: [embed],
      components: [buttons, buttons2],
    });

    // Zapisz ID wiadomości kontrolnej
    tempChannelDoc.controlMessageId = message.id;
    await tempChannelDoc.save();
  } catch (error) {
    logger.error(`Błąd podczas wysyłania panelu kontrolnego: ${error}`);
  }
}

async function moveUserToChannel(newState: VoiceState, newChannel: VoiceChannel): Promise<void> {
  if (!newState.member) return;

  // Sprawdź czy użytkownik jest nadal połączony z voice
  if (!newState.channel) {
    logger.warn('Użytkownik opuścił kanał przed przeniesieniem');
    return;
  }

  await retryOperation(
    async (): Promise<void> => {
      if (newState.member && newState.channel) {
        // Przenieś użytkownika z kanału monitora do nowego kanału
        await newState.member.voice.setChannel(newChannel.id);
      }
    },
    3,
    1000
  );
}

async function cleanupEmptyTempChannel(oldState: VoiceState): Promise<void> {
  if (!oldState.channel || oldState.channel.members.size > 0) {
    return;
  }

  const tempChannel = await TempChannelModel.findOne({
    channelId: oldState.channelId,
  });

  if (!tempChannel || !oldState.channel) {
    return;
  }

  // Spróbuj usunąć control message przed usunięciem kanału
  if (tempChannel.controlMessageId) {
    try {
      const controlMessage = await oldState.channel.messages.fetch(tempChannel.controlMessageId);
      await controlMessage.delete();
    } catch (error) {
      // Wiadomość może już nie istnieć lub nie można jej usunąć - to nie problem
      logger.debug(`Nie można usunąć control message: ${error}`);
    }
  }

  await retryOperation<GuildChannel>(() => oldState.channel!.delete(), 3, 1000);

  await TempChannelModel.findOneAndDelete({
    channelId: oldState.channelId,
  });
}

function isJoiningMonitoredChannel(
  oldState: VoiceState,
  newState: VoiceState,
  monitoredChannelIds: string[]
): boolean {
  return Boolean(
    newState.channelId &&
      monitoredChannelIds.includes(newState.channelId) &&
      oldState.channelId !== newState.channelId
  );
}
