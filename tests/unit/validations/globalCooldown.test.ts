import globalCooldown, { clearCooldowns } from '../../../src/validations/globalCooldown';

function fakeInteraction(userId: string): any {
  return { user: { id: userId } };
}
function fakeCommand(cooldown?: number): any {
  return { options: cooldown !== undefined ? { cooldown } : {} };
}

describe('globalCooldown', () => {
  beforeEach(() => {
    clearCooldowns();
  });

  it('allows first call (returns null)', async () => {
    const res = await globalCooldown(fakeInteraction('u1'), fakeCommand());
    expect(res).toBeNull();
  });

  it('blocks second call within cooldown window', async () => {
    await globalCooldown(fakeInteraction('u1'), fakeCommand(5));
    const res = await globalCooldown(fakeInteraction('u1'), fakeCommand(5));
    expect(res).toBeTruthy();
    expect(res).toContain('sekund');
  });

  it('allows after cooldown expires', async () => {
    jest.useFakeTimers();
    await globalCooldown(fakeInteraction('u1'), fakeCommand(1));
    jest.advanceTimersByTime(1500);
    const res = await globalCooldown(fakeInteraction('u1'), fakeCommand(1));
    expect(res).toBeNull();
    jest.useRealTimers();
  });

  it('uses default 2s cooldown when not specified', async () => {
    jest.useFakeTimers();
    await globalCooldown(fakeInteraction('u1'), fakeCommand());
    // After 1.5s still blocked (default 2s)
    jest.advanceTimersByTime(1500);
    const blocked = await globalCooldown(fakeInteraction('u1'), fakeCommand());
    expect(blocked).toBeTruthy();
    // After 2.5s total → should be clear
    jest.advanceTimersByTime(1000);
    const clear = await globalCooldown(fakeInteraction('u1'), fakeCommand());
    expect(clear).toBeNull();
    jest.useRealTimers();
  });

  it('tracks different users independently', async () => {
    await globalCooldown(fakeInteraction('u1'), fakeCommand(60));
    const res = await globalCooldown(fakeInteraction('u2'), fakeCommand(60));
    expect(res).toBeNull();
  });

  it('returns remaining seconds in message', async () => {
    jest.useFakeTimers();
    await globalCooldown(fakeInteraction('u1'), fakeCommand(5));
    jest.advanceTimersByTime(2000); // 3s left
    const res = await globalCooldown(fakeInteraction('u1'), fakeCommand(5));
    expect(res).toMatch(/3 sekund/);
    jest.useRealTimers();
  });

  it('clearCooldowns resets state', async () => {
    await globalCooldown(fakeInteraction('u1'), fakeCommand(60));
    clearCooldowns();
    const res = await globalCooldown(fakeInteraction('u1'), fakeCommand(60));
    expect(res).toBeNull();
  });

  it('triggers cleanup after every 200 checks', async () => {
    jest.useFakeTimers();
    // Make 199 calls with different users (short cooldown, already expired)
    for (let i = 0; i < 199; i++) {
      await globalCooldown(fakeInteraction(`batch-${i}`), fakeCommand(0.001));
    }
    // Advance time so all cooldowns expire
    jest.advanceTimersByTime(5000);
    // 200th call triggers cleanup (checks % 200 === 0)
    const res = await globalCooldown(fakeInteraction('trigger'), fakeCommand(0.001));
    expect(res).toBeNull();
    jest.useRealTimers();
  });
});
