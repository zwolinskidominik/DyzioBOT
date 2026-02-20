import { ServiceResult, ok, fail } from '../types/serviceResult';
import { TempChannelModel } from '../models/TempChannel';
import { TempChannelConfigurationModel } from '../models/TempChannelConfiguration';

/* ── Types ────────────────────────────────────────────────── */

export interface TempChannelData {
  guildId: string;
  parentId: string;
  channelId: string;
  ownerId: string;
  controlMessageId?: string;
}

export interface TransferResult {
  oldOwnerId: string;
  newOwnerId: string;
}

/* ── Service functions ────────────────────────────────────── */

/**
 * Get the list of monitored "creator" channel IDs for a guild.
 */
export async function getMonitoredChannels(
  guildId: string,
): Promise<ServiceResult<string[]>> {
  const config = await TempChannelConfigurationModel.findOne({ guildId });
  return ok(config?.channelIds ?? []);
}

/**
 * Save a new temporary channel record after Discord channel creation.
 */
export async function saveTempChannel(data: {
  guildId: string;
  parentId: string;
  channelId: string;
  ownerId: string;
}): Promise<ServiceResult<TempChannelData>> {
  const doc = await TempChannelModel.create(data);
  return ok(toData(doc));
}

/**
 * Delete the temp channel DB record (cleanup).
 */
export async function deleteTempChannel(
  channelId: string,
): Promise<ServiceResult<void>> {
  await TempChannelModel.findOneAndDelete({ channelId });
  return ok(undefined);
}

/**
 * Transfer ownership to a new user. Returns old and new owner IDs.
 */
export async function transferOwnership(
  channelId: string,
  newOwnerId: string,
): Promise<ServiceResult<TransferResult>> {
  const doc = await TempChannelModel.findOne({ channelId });
  if (!doc) return fail('NOT_FOUND', 'Nie znaleziono kanału tymczasowego.');

  const oldOwnerId = doc.ownerId;
  doc.ownerId = newOwnerId;
  await doc.save();

  return ok({ oldOwnerId, newOwnerId });
}

/**
 * Get temp channel record by channelId.
 */
export async function getTempChannel(
  channelId: string,
): Promise<ServiceResult<TempChannelData | null>> {
  const doc = await TempChannelModel.findOne({ channelId });
  return ok(doc ? toData(doc) : null);
}

/**
 * Validate that the given userId is the owner of the temp channel.
 * Returns the channel data on success.
 */
export async function validateOwnership(
  channelId: string,
  userId: string,
): Promise<ServiceResult<TempChannelData>> {
  const doc = await TempChannelModel.findOne({ channelId });
  if (!doc) return fail('NOT_FOUND', 'To nie jest tymczasowy kanał głosowy.');
  if (doc.ownerId !== userId) {
    return fail('NOT_OWNER', 'Tylko właściciel kanału może zarządzać tym kanałem.');
  }
  return ok(toData(doc));
}

/**
 * Store the control-panel message ID on the temp channel record.
 */
export async function setControlMessageId(
  channelId: string,
  messageId: string,
): Promise<ServiceResult<void>> {
  const doc = await TempChannelModel.findOneAndUpdate(
    { channelId },
    { controlMessageId: messageId },
    { new: true },
  );
  if (!doc) return fail('NOT_FOUND', 'Nie znaleziono kanału tymczasowego.');
  return ok(undefined);
}

/* ── Internal helpers ─────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toData(doc: any): TempChannelData {
  return {
    guildId: doc.guildId,
    parentId: doc.parentId,
    channelId: doc.channelId,
    ownerId: doc.ownerId,
    controlMessageId: doc.controlMessageId ?? undefined,
  };
}
