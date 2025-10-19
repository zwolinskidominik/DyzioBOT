import { EmbedBuilder } from 'discord.js';
import * as pingCmd from '../../../src/commands/misc/ping';
import logger from '../../../src/utils/logger';

// Simple helper to create a fake interaction with needed methods mocked
function createMockInteraction() {
  const calls: Record<string, any[]> = {};
  const record = (name: string) => (...args: any[]) => {
    (calls[name] ||= []).push(args);
    return Promise.resolve(undefined);
  };

  return {
    calls,
    createdTimestamp: 1000,
    replied: false,
    deferred: false,
    deferReply: record('deferReply'),
    fetchReply: jest.fn().mockResolvedValue({ createdTimestamp: 1016 }),
    editReply: record('editReply'),
    reply: record('reply'),
    followUp: record('followUp'),
  } as any;
}

function createMockClient(ping = 42) {
  return {
    ws: { ping },
  } as any;
}

describe('command: /ping', () => {
  it('builds and edits reply with ping embed (happy path)', async () => {
    const interaction = createMockInteraction();
    const client = createMockClient(50);

    await pingCmd.run({ interaction, client } as any);

    // fetchReply used to compute latency
    expect(interaction.fetchReply).toHaveBeenCalledTimes(1);

    // Should edit original reply with an embed
    const edits = interaction.calls.editReply || [];
    expect(edits.length).toBe(1);
    const payload = edits[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0]).toBeInstanceOf(EmbedBuilder);
  });

  it('logs error and edits with error embed when run throws', async () => {
    // Mock editReply to throw first, then allow catch branch to call editReply again (ignored by catch)
    const interaction = createMockInteraction();
    const client = createMockClient(50);

    // Force an error by making fetchReply reject
    (interaction.fetchReply as jest.Mock).mockRejectedValueOnce(new Error('network'));

    // Spy on logger to ensure error path reached
  const spy = jest
      .spyOn(logger, 'error')
      .mockImplementation((..._args: any[]) => logger as any);

    await pingCmd.run({ interaction, client } as any);

    // Despite error, catch block should try to edit reply with error embed
    const edits = interaction.calls.editReply || [];
    expect(edits.length).toBe(1);
    const payload = edits[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });
});
