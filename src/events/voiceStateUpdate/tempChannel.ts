import {
  VoiceState,
  ChannelType,
  GuildChannel,
  VoiceChannel,
  GuildChannelCreateOptions,
  GuildChannelTypes,
} from 'discord.js';
import { TempChannelModel } from '../../models/TempChannel';
import { TempChannelConfigurationModel } from '../../models/TempChannelConfiguration';
import logger from '../../utils/logger';

export default async function run(oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    const monitoredChannelIds = await getMonitoredChannels(newState.guild.id);

    if (isJoiningMonitoredChannel(oldState, newState, monitoredChannelIds)) {
      const newChannel = await createTemporaryChannel(newState);

      await saveTemporaryChannel(newState, newChannel);

      await moveUserToChannel(newState, newChannel);
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

  const channelName = newState.channel?.name || `Tymczasowy kanał`;

  const channelOptions: GuildChannelCreateOptions & { type: GuildChannelTypes } = {
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: parentChannel,
    userLimit: newState.channel?.userLimit,
    permissionOverwrites: newState.channel?.permissionOverwrites.cache.map((permission) => ({
      id: permission.id,
      allow: permission.allow,
      deny: permission.deny,
      type: permission.type,
    })),
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
      return channel;
    },
    3,
    1000
  );
}

async function saveTemporaryChannel(newState: VoiceState, newChannel: VoiceChannel): Promise<void> {
  const guild = newState.guild;
  const parentChannel = (newState.channel as GuildChannel)?.parent;

  const tempChannel = new TempChannelModel({
    guildId: guild.id,
    parentId: parentChannel?.id,
    channelId: newChannel.id,
    ownerId: newState.member?.id,
  });

  await tempChannel.save();
}

async function moveUserToChannel(newState: VoiceState, newChannel: VoiceChannel): Promise<void> {
  if (!newState.member) return;

  await retryOperation(
    async (): Promise<void> => {
      if (newState.member) {
        await newState.setChannel(newChannel);
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
