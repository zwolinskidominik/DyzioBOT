import globalCooldown from '../../../src/validations/globalCooldown';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../src/interfaces/Command';

describe('validations/globalCooldown', () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterAll(() => {
    (Date.now as any).mockRestore?.();
  });

  function mockInteraction(userId: string): ChatInputCommandInteraction {
    return { user: { id: userId } } as unknown as ChatInputCommandInteraction;
  }

  test('first call ok, second blocked, then unblocked after custom cooldown', async () => {
    const interaction = mockInteraction('user-custom');
    const command: ICommand = {
      data: { name: 'x' } as any,
      run: async () => {},
      options: { cooldown: 0.5 }, // 0.5 seconds instead of 500ms
    };

    let res = await globalCooldown(interaction, command);
    expect(res).toBeNull();

    res = await globalCooldown(interaction, command);
    expect(typeof res).toBe('string');
    expect(res).toMatch(/Odczekaj/);

    now += 400;
    res = await globalCooldown(interaction, command);
    expect(res).not.toBeNull();

    now += 200;
    res = await globalCooldown(interaction, command);
    expect(res).toBeNull();
  });

  test('uses default cooldown when none provided and resets after time', async () => {
    now = 2_000_000;
    const interaction = mockInteraction('user-default');
    const command: ICommand = { data: { name: 'y' } as any, run: async () => {}, options: {} };

    let res = await globalCooldown(interaction, command);
    expect(res).toBeNull();

    res = await globalCooldown(interaction, command);
    expect(res).toMatch(/Odczekaj/);

    now += 2_499;
    res = await globalCooldown(interaction, command);
    expect(res).toBeTruthy();

    now += 2;
    res = await globalCooldown(interaction, command);
    expect(res).toBeNull();
  });

  test('purge logic after >200 checks allows reuse of earliest user', async () => {
    now = 3_000_000;
    const command: ICommand = { data: { name: 'z' } as any, run: async () => {}, options: { cooldown: 1 } }; // 1 second instead of 1000ms
    for (let i = 0; i < 200; i++) {
      await globalCooldown(mockInteraction('u' + i), command);
    }
    now += 2000;
    await globalCooldown(mockInteraction('trigger'), command);
    const res = await globalCooldown(mockInteraction('u0'), command);
    expect(res).toBeNull();
  });
});
