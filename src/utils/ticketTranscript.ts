import { TextChannel, Message, Collection } from 'discord.js';

const MAX_TRANSCRIPT_MESSAGES = 500;
const FETCH_BATCH_SIZE = 100;

/**
 * Fetch up to MAX_TRANSCRIPT_MESSAGES messages from a ticket channel (oldest
 * first) and render them into a plain-text transcript buffer.
 */
export async function buildTranscriptBuffer(channel: TextChannel): Promise<Buffer> {
  const collected: Message[] = [];
  let beforeId: string | undefined;

  while (collected.length < MAX_TRANSCRIPT_MESSAGES) {
    const batch: Collection<string, Message> = await channel.messages.fetch({
      limit: FETCH_BATCH_SIZE,
      ...(beforeId ? { before: beforeId } : {}),
    });
    if (batch.size === 0) break;

    collected.push(...batch.values());
    beforeId = batch.last()?.id;
    if (batch.size < FETCH_BATCH_SIZE) break;
  }

  collected.reverse(); // oldest → newest

  const lines = collected.map((message) => {
    const timestamp = message.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const author = message.author?.tag ?? message.author?.id ?? 'Nieznany';
    const content =
      message.content ||
      (message.embeds.length ? '[embed]' : message.attachments.size ? '[załącznik]' : '');
    return `[${timestamp}] ${author}: ${content}`;
  });

  const header = [
    `Transkrypt kanału #${channel.name} (${channel.id})`,
    `Wygenerowano: ${new Date().toISOString()}`,
    `Liczba wiadomości: ${collected.length}${collected.length >= MAX_TRANSCRIPT_MESSAGES ? ' (limit)' : ''}`,
    '='.repeat(60),
    '',
  ].join('\n');

  return Buffer.from(header + lines.join('\n'), 'utf-8');
}
