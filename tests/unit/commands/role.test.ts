/**
 * Unit tests for /role command (temp, remove, list sub-commands).
 */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    addFields: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
  }),
  createErrorEmbed: jest.fn().mockReturnValue({
    addFields: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
  }),
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C' },
}));

jest.mock('../../../src/utils/moderationHelpers', () => ({
  parseDuration: jest.fn(),
  formatHumanDuration: jest.fn().mockReturnValue('1d'),
}));

jest.mock('../../../src/services/tempRoleService', () => ({
  addTempRole: jest.fn(),
  removeTempRole: jest.fn(),
  listTempRoles: jest.fn(),
}));

import { mockInteraction, mockGuildMember, mockUser, mockGuild } from '../../helpers/discordMocks';
import { parseDuration } from '../../../src/utils/moderationHelpers';
import { addTempRole, removeTempRole, listTempRoles } from '../../../src/services/tempRoleService';

const mockedParseDuration = parseDuration as jest.MockedFunction<typeof parseDuration>;
const mockedAddTempRole = addTempRole as jest.MockedFunction<typeof addTempRole>;
const mockedRemoveTempRole = removeTempRole as jest.MockedFunction<typeof removeTempRole>;
const mockedListTempRoles = listTempRoles as jest.MockedFunction<typeof listTempRoles>;

/* ── data export ──────────────────────────────────────────── */
describe('/role command - data export', () => {
  it('exports correct command name', () => {
    const { data } = require('../../../src/commands/admin/role');
    expect(data.name).toBe('role');
  });

  it('exports guildOnly option', () => {
    const { options } = require('../../../src/commands/admin/role');
    expect(options.guildOnly).toBe(true);
  });

  it('has temp, remove, and list subcommands', () => {
    const { data } = require('../../../src/commands/admin/role');
    const json = data.toJSON();
    const subNames = json.options.map((o: any) => o.name);
    expect(subNames).toContain('temp');
    expect(subNames).toContain('remove');
    expect(subNames).toContain('list');
  });
});

/* ── /role temp ───────────────────────────────────────────── */
describe('/role temp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createTempInteraction(overrides: Record<string, unknown> = {}) {
    const targetUser = mockUser({ id: 'target-1' });
    const role = {
      id: 'role-1',
      name: 'VIP',
      position: 3,
      managed: false,
      toString: () => '<@&role-1>',
    };
    const guild = mockGuild({
      id: 'g1',
      members: {
        me: mockGuildMember({ id: 'bot-id', highestPos: 99 }),
        cache: new Map(),
        fetch: jest.fn().mockResolvedValue(mockGuildMember({ id: 'target-1', highestPos: 2 })),
      },
    });

    const interaction = mockInteraction({
      guild,
      member: mockGuildMember({ id: 'mod-1', highestPos: 10 }),
      _options: { _subcommand: 'temp', uzytkownik: targetUser, czas: '1d', powod: null },
      ...overrides,
    });

    // Add getRole mock
    interaction.options.getRole = jest.fn().mockReturnValue(role);

    return { interaction, targetUser, role, guild };
  }

  it('defers reply', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const { interaction } = createTempInteraction();
    mockedParseDuration.mockReturnValue(86_400_000);
    mockedAddTempRole.mockResolvedValue({
      ok: true,
      data: {
        guildId: 'g1', userId: 'target-1', roleId: 'role-1',
        expiresAt: new Date(Date.now() + 86_400_000), assignedBy: 'mod-1',
      },
    });

    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('rejects invalid duration', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const { interaction } = createTempInteraction();
    mockedParseDuration.mockReturnValue(null);

    await run({ interaction, client: interaction.client });
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockedAddTempRole).not.toHaveBeenCalled();
  });

  it('rejects managed roles', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const { interaction } = createTempInteraction();
    interaction.options.getRole = jest.fn().mockReturnValue({
      id: 'role-managed', name: 'Bot Role', position: 3, managed: true,
    });
    mockedParseDuration.mockReturnValue(86_400_000);

    await run({ interaction, client: interaction.client });
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockedAddTempRole).not.toHaveBeenCalled();
  });

  it('rejects when role is above requester', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const { interaction } = createTempInteraction();
    interaction.options.getRole = jest.fn().mockReturnValue({
      id: 'high-role', name: 'Admin', position: 50, managed: false,
    });
    // requester highestPos is 10, role position is 50
    mockedParseDuration.mockReturnValue(86_400_000);

    await run({ interaction, client: interaction.client });
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockedAddTempRole).not.toHaveBeenCalled();
  });

  it('calls addTempRole on success', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const { interaction } = createTempInteraction();
    mockedParseDuration.mockReturnValue(86_400_000);
    mockedAddTempRole.mockResolvedValue({
      ok: true,
      data: {
        guildId: 'g1', userId: 'target-1', roleId: 'role-1',
        expiresAt: new Date(Date.now() + 86_400_000), assignedBy: 'mod-1',
      },
    });

    await run({ interaction, client: interaction.client });
    expect(mockedAddTempRole).toHaveBeenCalledWith(
      'g1', 'target-1', 'role-1', 86_400_000, expect.any(String), undefined,
    );
  });
});

/* ── /role remove ──────────────────────────────────────────── */
describe('/role remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes temp role entry and Discord role', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const guild = mockGuild({ id: 'g1' });
    const targetUser = mockUser({ id: 'target-1' });
    const role = { id: 'role-1', name: 'VIP', position: 3, managed: false, toString: () => '<@&role-1>' };

    const memberWithRole = mockGuildMember({ id: 'target-1' });
    memberWithRole.roles.cache = { has: jest.fn().mockReturnValue(true) };
    guild.members.fetch = jest.fn().mockResolvedValue(memberWithRole);

    const interaction = mockInteraction({
      guild,
      _options: { _subcommand: 'remove', uzytkownik: targetUser },
    });
    interaction.options.getRole = jest.fn().mockReturnValue(role);

    mockedRemoveTempRole.mockResolvedValue({ ok: true, data: true });

    await run({ interaction, client: interaction.client });
    expect(mockedRemoveTempRole).toHaveBeenCalledWith('g1', 'target-1', 'role-1');
    expect(memberWithRole.roles.remove).toHaveBeenCalledWith(role, expect.any(String));
  });

  it('replies with error when no entry found', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const targetUser = mockUser({ id: 'target-1' });
    const role = { id: 'role-1', name: 'VIP', position: 3, managed: false };

    const interaction = mockInteraction({
      _options: { _subcommand: 'remove', uzytkownik: targetUser },
    });
    interaction.options.getRole = jest.fn().mockReturnValue(role);

    mockedRemoveTempRole.mockResolvedValue({ ok: true, data: false });

    await run({ interaction, client: interaction.client });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ── /role list ───────────────────────────────────────────── */
describe('/role list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows entries when there are active temp roles', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const interaction = mockInteraction({
      _options: { _subcommand: 'list', uzytkownik: null },
    });
    interaction.options.getRole = jest.fn().mockReturnValue(null);

    mockedListTempRoles.mockResolvedValue({
      ok: true,
      data: [
        { guildId: 'g1', userId: 'u1', roleId: 'r1', expiresAt: new Date(Date.now() + 60_000), assignedBy: 'mod-1' },
        { guildId: 'g1', userId: 'u2', roleId: 'r2', expiresAt: new Date(Date.now() + 120_000), assignedBy: 'mod-1' },
      ],
    });

    await run({ interaction, client: interaction.client });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows empty message when no temp roles', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const interaction = mockInteraction({
      _options: { _subcommand: 'list', uzytkownik: null },
    });
    interaction.options.getRole = jest.fn().mockReturnValue(null);

    mockedListTempRoles.mockResolvedValue({ ok: true, data: [] });

    await run({ interaction, client: interaction.client });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('filters by user when provided', async () => {
    const { run } = require('../../../src/commands/admin/role');
    const filterUser = mockUser({ id: 'u1' });
    const interaction = mockInteraction({
      _options: { _subcommand: 'list', uzytkownik: filterUser },
    });
    interaction.options.getRole = jest.fn().mockReturnValue(null);

    mockedListTempRoles.mockResolvedValue({ ok: true, data: [] });

    await run({ interaction, client: interaction.client });
    expect(mockedListTempRoles).toHaveBeenCalledWith(expect.any(String), 'u1');
  });
});
