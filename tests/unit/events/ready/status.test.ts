import run from '../../../../src/events/clientReady/status';

describe('clientReady/status event', () => {
  test('sets presence when client.user exists', async () => {
    const setPresence = jest.fn().mockResolvedValue(undefined);
    const client: any = { user: { setPresence } };
    await run(client);
    expect(setPresence).toHaveBeenCalledWith({
      activities: [
        { name: '/help', type: expect.any(Number) },
      ],
      status: 'online',
    });
  });

  test('gracefully returns if client.user missing', async () => {
    const client: any = { user: null };
    await expect(run(client)).resolves.toBeUndefined();
  });
});
