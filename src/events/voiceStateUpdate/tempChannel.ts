import {
  VoiceState,
  ChannelType,
  GuildChannel,
  VoiceChannel,
  GuildChannelCreateOptions,
  GuildChannelTypes,
} from 'discord.js';
import {
  getCreatorConfigs,
  saveTempChannel,
  deleteTempChannel,
  transferOwnership,
  getTempChannel,
  setControlMessageId,
  TempChannelData,
} from '../../services/tempChannelService';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { createControlPanelButtons } from '../interactionCreate/voiceControl';
import logger from '../../utils/logger';

export default async function run(oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    const configResult = await getCreatorConfigs(newState.guild.id);
    const creatorConfigs = configResult.ok ? configResult.data : [];
    const monitoredChannelIds = creatorConfigs.map((c) => c.channelId);

    if (isJoiningMonitoredChannel(oldState, newState, monitoredChannelIds)) {
      const creatorType = creatorConfigs.find((c) => c.channelId === newState.channelId)?.type ?? 'panel';
      const newChannel = await createTemporaryChannel(newState);

      const tempChannelData = await saveTemporaryChannelRecord(newState, newChannel);

      if (creatorType === 'panel') {
        await sendControlPanel(newChannel, tempChannelData);
      }

      await moveUserToChannel(newState, newChannel);
    }
    
    if (newState.channel && newState.channelId !== oldState.channelId) {
      const tcResult = await getTempChannel(newState.channelId!);
      const tempChannel = tcResult.ok ? tcResult.data : null;
      
      if (tempChannel && newState.member && newState.channel instanceof VoiceChannel) {
        await newState.channel.permissionOverwrites.edit(newState.member.id, {
          ReadMessageHistory: true,
          ViewChannel: true,
          SendMessages: true,
        });
      }
    }

    await cleanupEmptyTempChannel(oldState, newState);
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


async function createTemporaryChannel(newState: VoiceState): Promise<VoiceChannel> {
  const guild = newState.guild;
  const parentChannel = (newState.channel as GuildChannel)?.parent;

  if (!guild || !guild.channels) {
    throw new Error('Guild lub guild.channels jest undefined.');
  }

  const channelName = newState.member 
    ? `Kanał - ${newState.member.displayName}`
    : `Tymczasowy kanał`;

  const channelOptions: GuildChannelCreateOptions & { type: GuildChannelTypes } = {
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: parentChannel,
    userLimit: newState.channel?.userLimit,
    permissionOverwrites: [],
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

async function saveTemporaryChannelRecord(newState: VoiceState, newChannel: VoiceChannel): Promise<TempChannelData> {
  const guild = newState.guild;
  const parentChannel = (newState.channel as GuildChannel)?.parent;

  if (!parentChannel) {
    throw new Error('Kanał rodzica nie istnieje - nie można utworzyć tymczasowego kanału');
  }

  const result = await saveTempChannel({
    guildId: guild.id,
    parentId: parentChannel.id,
    channelId: newChannel.id,
    ownerId: newState.member?.id ?? '',
  });

  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.data;
}

async function sendControlPanel(channel: VoiceChannel, tempChannelData: TempChannelData): Promise<void> {
  try {
    const embed = createBaseEmbed({
      title: '⚙️ Panel zarządzania kanałem',
      description: `<@${tempChannelData.ownerId}> - Witaj na swoim tymczasowym kanale!`,
      timestamp: false,
    }).setFooter({ text: 'Użyj przycisków poniżej, aby zarządzać tym kanałem głosowym' });

    const [buttons, buttons2] = createControlPanelButtons();

    const message = await channel.send({
      content: `<@${tempChannelData.ownerId}>`,
      embeds: [embed],
      components: [buttons, buttons2],
    });

    await setControlMessageId(tempChannelData.channelId, message.id);
  } catch (error) {
    logger.error(`Błąd podczas wysyłania panelu kontrolnego: ${error}`);
  }
}

async function moveUserToChannel(newState: VoiceState, newChannel: VoiceChannel): Promise<void> {
  if (!newState.member) return;

  if (!newState.channel) {
    // Użytkownik opuścił kanał przed przeniesieniem - usuń pusty tymczasowy kanał
    try {
      const tcResult = await getTempChannel(newChannel.id);
      const tempChannel = tcResult.ok ? tcResult.data : null;
      if (tempChannel && newChannel.members.size === 0) {
        await newChannel.delete();
        await deleteTempChannel(newChannel.id);
      }
    } catch (error) {
      logger.debug(`Nie można usunąć pustego kanału: ${error}`);
    }
    return;
  }

  await retryOperation(
    async (): Promise<void> => {
      if (newState.member && newState.channel) {
        await newState.member.voice.setChannel(newChannel.id);
      }
    },
    3,
    1000
  );
}

async function cleanupEmptyTempChannel(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (!oldState.channel) {
    return;
  }

  const tcResult = await getTempChannel(oldState.channelId!);
  const tempChannel = tcResult.ok ? tcResult.data : null;

  if (!tempChannel) {
    return;
  }

  const ownerLeftChannel = oldState.member?.id === tempChannel.ownerId 
    && oldState.channelId !== newState.channelId;

  if (ownerLeftChannel && oldState.channel instanceof VoiceChannel) {
    const remainingMembers = Array.from(oldState.channel.members.values()).filter(
      (member) => !member.user.bot
    );

    if (remainingMembers.length > 0) {
      const newOwner = remainingMembers[0];
      await transferOwnership(oldState.channelId!, newOwner.id);

      await oldState.channel.permissionOverwrites.edit(newOwner.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        Stream: true,
        MuteMembers: true,
        DeafenMembers: true,
        MoveMembers: true,
      });

      try {
        if (oldState.member?.id) {
          await oldState.channel.permissionOverwrites.delete(oldState.member.id);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.debug(`Nie można usunąć uprawnień starego właściciela: ${errorMsg}`);
      }

      if (tempChannel.controlMessageId) {
        try {
          const controlMessage = await oldState.channel.messages.fetch(tempChannel.controlMessageId);
          
          const embed = createBaseEmbed({
            title: '🎛️ Panel Zarządzania Kanałem',
            description:
              `<@${newOwner.id}> - Witaj w swoim tymczasowym kanale!\n\n` +
              `Użyj przycisków poniżej, aby zarządzać tym kanałem głosowym.`,
            timestamp: false,
          });

          const [buttons, buttons2] = createControlPanelButtons();

          await controlMessage.edit({
            content: `<@${newOwner.id}>`,
            embeds: [embed],
            components: [buttons, buttons2],
          });
        } catch (error) {
          logger.debug(`Nie można zaktualizować panelu kontrolnego: ${error}`);
        }
      }

      try {
        await oldState.channel.send({
          content: `👑 Poprzedni właściciel opuścił kanał. Własność przekazana użytkownikowi <@${newOwner.id}>`,
        });
      } catch (error) {
        logger.debug(`Nie można wysłać wiadomości o przekazaniu własności: ${error}`);
      }

      logger.debug(`Przekazano własność kanału ${oldState.channel?.name || oldState.channelId} od ${oldState.member?.id} do ${newOwner.id}`);
      return;
    }
  }

  
  const channelStillExists = oldState.guild.channels.cache.has(oldState.channelId!);
  
  if (!channelStillExists) {
    logger.warn(`Kanał został już usunięty przed cleanup`);
    await deleteTempChannel(oldState.channelId!);
    return;
  }

  if (oldState.channel.members.size > 0) {
    return;
  }

  if (tempChannel.controlMessageId && oldState.channel) {
    try {
      const controlMessage = await oldState.channel.messages.fetch(tempChannel.controlMessageId);
      await controlMessage.delete();
    } catch (error) {
      logger.debug(`Nie można usunąć control message: ${error}`);
    }
  }

  try {
    const channel = oldState.guild.channels.cache.get(oldState.channelId!);
    if (channel) {
      await retryOperation(async () => await channel.delete(), 3, 1000);
    }
  } catch (error) {
    logger.warn(`Nie udało się usunąć kanału ${oldState.channelId}: ${error}`);
  }

  await deleteTempChannel(oldState.channelId!);
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
