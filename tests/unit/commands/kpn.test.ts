/**
 * Unit tests for /kpn (Kamień Papier Nożyce) command.
 */

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    addFields: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
  }),
  createErrorEmbed: jest.fn().mockReturnValue({
    setDescription: jest.fn().mockReturnThis(),
  }),
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54' },
}));

import { pickBotChoice, getOutcome } from '../../../src/commands/fun/kpn';
import { mockInteraction } from '../../helpers/discordMocks';

/* ── Pure logic tests ─────────────────────────────────────── */
describe('pickBotChoice', () => {
  it('returns one of rock, paper, scissors', () => {
    const valid = ['rock', 'paper', 'scissors'];
    for (let i = 0; i < 50; i++) {
      expect(valid).toContain(pickBotChoice());
    }
  });
});

describe('getOutcome', () => {
  it('returns draw when same choice', () => {
    expect(getOutcome('rock', 'rock')).toBe('draw');
    expect(getOutcome('paper', 'paper')).toBe('draw');
    expect(getOutcome('scissors', 'scissors')).toBe('draw');
  });

  it('rock beats scissors', () => {
    expect(getOutcome('rock', 'scissors')).toBe('win');
  });

  it('paper beats rock', () => {
    expect(getOutcome('paper', 'rock')).toBe('win');
  });

  it('scissors beats paper', () => {
    expect(getOutcome('scissors', 'paper')).toBe('win');
  });

  it('rock loses to paper', () => {
    expect(getOutcome('rock', 'paper')).toBe('lose');
  });

  it('paper loses to scissors', () => {
    expect(getOutcome('paper', 'scissors')).toBe('lose');
  });

  it('scissors loses to rock', () => {
    expect(getOutcome('scissors', 'rock')).toBe('lose');
  });
});

/* ── Command structure ────────────────────────────────────── */
describe('/kpn command - data export', () => {
  it('exports correct command name', () => {
    const { data } = require('../../../src/commands/fun/kpn');
    expect(data.name).toBe('kamien-papier-nozyce');
  });

  it('has a cooldown', () => {
    const { options } = require('../../../src/commands/fun/kpn');
    expect(options.cooldown).toBeDefined();
    expect(typeof options.cooldown).toBe('number');
  });
});

/* ── run function ─────────────────────────────────────────── */
describe('/kpn run', () => {
  it('replies with embed and buttons', async () => {
    const { run } = require('../../../src/commands/fun/kpn');

    const mockMessage = {
      createMessageComponentCollector: jest.fn().mockReturnValue({
        on: jest.fn(),
      }),
    };

    const interaction = mockInteraction();
    interaction.fetchReply = jest.fn().mockResolvedValue(mockMessage);

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      })
    );
    expect(interaction.fetchReply).toHaveBeenCalled();
    expect(mockMessage.createMessageComponentCollector).toHaveBeenCalledWith(
      expect.objectContaining({
        componentType: expect.any(Number),
        time: 30_000,
        max: 1,
      })
    );
  });
});
