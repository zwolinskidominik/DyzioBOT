import runStatus from '../../../src/events/ready/status';

describe('event: ready/status', () => {
  it('returns early when client.user is missing', async () => {
    const client: any = { user: undefined };
    await runStatus(client);
  });

  it('sets presence when client.user exists', async () => {
    const setPresence = jest.fn().mockResolvedValue(undefined);
    const client: any = { user: { setPresence } };

    await runStatus(client);

    expect(setPresence).toHaveBeenCalledTimes(1);
    const arg = setPresence.mock.calls[0][0];
    expect(arg).toHaveProperty('activities');
    expect(arg).toHaveProperty('status');
  });
});
