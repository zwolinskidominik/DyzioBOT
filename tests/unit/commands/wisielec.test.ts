/**
 * Unit tests for /wisielec (Hangman) command.
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
  COLORS: {
    DEFAULT: '#4C4C54',
    HANGMAN: '#E67E22',
    HANGMAN_WIN: '#57F287',
    HANGMAN_LOSE: '#ED4245',
  },
}));

const mockCategories = [
  { name: 'Zwierzęta', emoji: '🐾', words: ['kot', 'pies', 'tygrys', 'lew', 'słoń'] },
  { name: 'Jedzenie', emoji: '🍕', words: ['pizza', 'chleb', 'masło', 'ser', 'jabłko'] },
  { name: 'Sport', emoji: '⚽', words: ['piłka', 'bieg', 'skok', 'pływanie', 'tenis'] },
];

jest.mock('../../../src/models/HangmanCategory', () => ({
  HangmanCategoryModel: {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockCategories) }),
  },
}));

import {
  pickRandomWord,
  getWordDisplay,
  isWordGuessed,
} from '../../../src/commands/fun/wisielec';
import { MAX_WRONG_GUESSES } from '../../../src/config/constants/hangmanWords';
import { mockInteraction } from '../../helpers/discordMocks';

/* ── pickRandomWord ───────────────────────────────────────── */
describe('pickRandomWord', () => {
  it('returns a word and category from the database', async () => {
    const { word, category } = await pickRandomWord();
    expect(typeof word).toBe('string');
    expect(word.length).toBeGreaterThan(0);
    const matchingCat = mockCategories.find((c) => c.name === category.name);
    expect(matchingCat).toBeDefined();
    expect(matchingCat!.words).toContain(word);
  });

  it('returns words from different categories over many runs', async () => {
    const seenCategories = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { category } = await pickRandomWord();
      seenCategories.add(category.name);
    }
    expect(seenCategories.size).toBeGreaterThan(1);
  });
});

/* ── getWordDisplay ───────────────────────────────────────── */
describe('getWordDisplay', () => {
  it('returns all underscores when no letters guessed', () => {
    const display = getWordDisplay('kot', new Set());
    expect(display).toBe('\\_ \\_ \\_');
  });

  it('reveals guessed letters in uppercase bold', () => {
    const display = getWordDisplay('kot', new Set(['k', 't']));
    expect(display).toBe('**K** \\_ **T**');
  });

  it('reveals full word when all letters guessed', () => {
    const display = getWordDisplay('kot', new Set(['k', 'o', 't']));
    expect(display).toBe('**K** **O** **T**');
  });

  it('handles repeated letters in the word', () => {
    const display = getWordDisplay('pizza', new Set(['z']));
    expect(display).toBe('\\_ \\_ **Z** **Z** \\_');
  });

  it('handles Polish diacritical characters', () => {
    const display = getWordDisplay('słoń', new Set(['s', 'ń']));
    expect(display).toBe('**S** \\_ \\_ **Ń**');
  });

  it('handles words with extra guessed letters', () => {
    const display = getWordDisplay('kot', new Set(['k', 'o', 't', 'a', 'b']));
    expect(display).toBe('**K** **O** **T**');
  });

  it('shows spaces as gaps in multi-word phrases', () => {
    const display = getWordDisplay('dom kot', new Set(['d', 'o', 'k']));
    expect(display).toBe('**D** **O** \\_ \u00A0\u00A0\u00A0\u00A0\u00A0 **K** **O** \\_');
  });

  it('reveals full multi-word phrase', () => {
    const display = getWordDisplay('dom kot', new Set(['d', 'o', 'm', 'k', 't']));
    expect(display).toBe('**D** **O** **M** \u00A0\u00A0\u00A0\u00A0\u00A0 **K** **O** **T**');
  });
});

/* ── isWordGuessed ────────────────────────────────────────── */
describe('isWordGuessed', () => {
  it('returns false when no letters guessed', () => {
    expect(isWordGuessed('kot', new Set())).toBe(false);
  });

  it('returns false when word is partially guessed', () => {
    expect(isWordGuessed('kot', new Set(['k', 'o']))).toBe(false);
  });

  it('returns true when all letters of the word are guessed', () => {
    expect(isWordGuessed('kot', new Set(['k', 'o', 't']))).toBe(true);
  });

  it('returns true with extra guessed letters beyond the word', () => {
    expect(isWordGuessed('kot', new Set(['a', 'b', 'k', 'o', 't']))).toBe(true);
  });

  it('handles words with repeated letters', () => {
    expect(isWordGuessed('pizza', new Set(['p', 'i', 'z', 'a']))).toBe(true);
  });

  it('treats spaces as auto-guessed in multi-word phrases', () => {
    expect(isWordGuessed('dom kot', new Set(['d', 'o', 'm', 'k', 't']))).toBe(true);
  });

  it('returns false for partial multi-word phrase', () => {
    expect(isWordGuessed('dom kot', new Set(['d', 'o', 'm']))).toBe(false);
  });
});

/* ── MAX_WRONG_GUESSES constant ───────────────────────────── */
describe('MAX_WRONG_GUESSES', () => {
  it('equals 7 (matching the 8 hangman images)', () => {
    expect(MAX_WRONG_GUESSES).toBe(7);
  });
});



/* ── Command structure ────────────────────────────────────── */
describe('/wisielec command - data export', () => {
  it('exports correct command name', () => {
    const { data } = require('../../../src/commands/fun/wisielec');
    expect(data.name).toBe('wisielec');
  });

  it('has a description', () => {
    const { data } = require('../../../src/commands/fun/wisielec');
    expect(data.description).toBeDefined();
    expect(data.description.length).toBeGreaterThan(0);
  });

  it('has a cooldown', () => {
    const { options } = require('../../../src/commands/fun/wisielec');
    expect(options.cooldown).toBeDefined();
    expect(typeof options.cooldown).toBe('number');
  });
});

/* ── run function ─────────────────────────────────────────── */
describe('/wisielec run', () => {
  it('replies with embed, files, and button components', async () => {
    const { run } = require('../../../src/commands/fun/wisielec');

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
        files: expect.any(Array),
        components: expect.any(Array),
      }),
    );

    const replyArgs = interaction.reply.mock.calls[0][0];
    // 5 keyboard rows
    expect(replyArgs.components).toHaveLength(5);
    // 1 hangman image attachment
    expect(replyArgs.files).toHaveLength(1);
  });

  it('creates a message component collector after reply', async () => {
    const { run } = require('../../../src/commands/fun/wisielec');

    const mockMessage = {
      createMessageComponentCollector: jest.fn().mockReturnValue({
        on: jest.fn(),
      }),
    };

    const interaction = mockInteraction();
    interaction.fetchReply = jest.fn().mockResolvedValue(mockMessage);

    await run({ interaction, client: interaction.client });

    expect(interaction.fetchReply).toHaveBeenCalled();
    expect(mockMessage.createMessageComponentCollector).toHaveBeenCalledWith(
      expect.objectContaining({
        componentType: expect.any(Number),
        time: 120_000,
      }),
    );
  });
});

/* ── Duel: command option ─────────────────────────────────── */
describe('/wisielec duel - command option', () => {
  it('has an optional "gracz" user option', () => {
    const { data } = require('../../../src/commands/fun/wisielec');
    const option = data.options?.find((o: any) => o.name === 'gracz');
    expect(option).toBeDefined();
    expect(option.required).toBeFalsy();
  });
});

/* ── Duel: challenge flow ─────────────────────────────────── */
describe('/wisielec duel - challenge flow', () => {
  const opponentUser = { id: 'opponent-1', tag: 'Opponent#0001', bot: false };
  const botUser = { id: 'bot-id', tag: 'Bot#0001', bot: true };

  function setupDuelInteraction(opponentOpt: any) {
    const mockMessage = {
      createMessageComponentCollector: jest.fn().mockReturnValue({ on: jest.fn() }),
      edit: jest.fn().mockResolvedValue(undefined),
      channel: { id: 'ch-1' },
    };

    const guild = {
      id: 'guild-1',
      members: {
        fetch: jest.fn().mockResolvedValue({
          user: opponentOpt ?? opponentUser,
        }),
      },
    };

    const interaction = mockInteraction({
      _options: { gracz: opponentOpt },
      guild,
    });
    interaction.fetchReply = jest.fn().mockResolvedValue(mockMessage);

    return { interaction, mockMessage };
  }

  it('replies with an ephemeral error when challenging yourself', async () => {
    const { run } = require('../../../src/commands/fun/wisielec');
    const selfUser = { id: 'user-1', tag: 'User_user-1#0001', bot: false };
    const interaction = mockInteraction({ _options: { gracz: selfUser } });

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('samego siebie'), ephemeral: true }),
    );
  });

  it('replies with an ephemeral error when challenging a bot', async () => {
    const { run } = require('../../../src/commands/fun/wisielec');

    const guild = {
      id: 'guild-1',
      members: {
        fetch: jest.fn().mockResolvedValue({ user: botUser }),
      },
    };

    const interaction = mockInteraction({
      _options: { gracz: botUser },
      guild,
    });

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Nie można wyzwać'), ephemeral: true }),
    );
  });

  it('sends a challenge embed with accept/reject buttons for a valid opponent', async () => {
    const { run } = require('../../../src/commands/fun/wisielec');
    const { interaction } = setupDuelInteraction(opponentUser);

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      }),
    );

    const replyArgs = interaction.reply.mock.calls[0][0];
    expect(replyArgs.components).toHaveLength(1);
  });
});
