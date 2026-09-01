import { ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../interfaces/Command';
import { BirthdayConfigurationModel } from '../models/BirthdayConfiguration';
import { LevelConfigModel } from '../models/LevelConfig';
import { GiveawayConfigModel } from '../models/GiveawayConfig';
import logger from '../utils/logger';

/**
 * Generyczna walidacja "czy moduł X jest włączony" dla komend, które nie mają
 * własnej kategorii pokrytej przez commandToggle.ts (fun/misc) ani własnego
 * bespoke systemu jak moderacja (checkCommandAccess) czy economy (isEconomyEnabled
 * w economyService). Każdy wpis w GATES odpowiada jednemu przełącznikowi w
 * dashboardzie — semantyka `isAllowed` MUSI być spójna z tym, co już sprawdza
 * odpowiadający event/scheduler dla tego modułu (patrz komentarze przy każdym).
 */
interface ModuleGate {
  commands: Set<string>;
  moduleLabel: string;
  isAllowed: (guildId: string) => Promise<boolean>;
}

const GATES: ModuleGate[] = [
  {
    // Te same 4 komendy co folder misc/birthdays/ — mają WŁASNĄ kategorię
    // "birthdays" (nadawaną automatycznie przez CommandHandler dla podfolderów),
    // więc commandToggle.ts (fun/misc) ich nie obejmuje.
    commands: new Set(['birthday', 'birthdays-next', 'birthday-remember', 'birthday-set-user']),
    moduleLabel: 'Urodziny',
    isAllowed: async (guildId) => {
      const config = await BirthdayConfigurationModel.findOne({ guildId }).lean();
      // Spójne z birthdayScheduler.ts — blokuje tylko jawne enabled:false, brak
      // configu (nikt jeszcze nie skonfigurował kanału) traktujemy jako włączone.
      return config?.enabled !== false;
    },
  },
  {
    commands: new Set(['level', 'toplvl', 'xp']),
    moduleLabel: 'Poziomy',
    isAllowed: async (guildId) => {
      const config = await LevelConfigModel.findOne({ guildId }).lean();
      // Spójne z xpService.ts (przyznawanie XP) — wymaga jawnego enabled:true.
      return config?.enabled === true;
    },
  },
  {
    commands: new Set(['giveaway']),
    moduleLabel: 'Giveaway',
    isAllowed: async (guildId) => {
      const config = await GiveawayConfigModel.findOne({ guildId }).lean();
      return config?.enabled === true;
    },
  },
];

export default async function moduleToggle(
  interaction: ChatInputCommandInteraction,
  command: ICommand
): Promise<string | null> {
  if (!interaction.guildId) return null;

  const commandName = command.data.name;
  const gate = GATES.find((g) => g.commands.has(commandName));
  if (!gate) return null;

  try {
    const allowed = await gate.isAllowed(interaction.guildId);
    if (!allowed) {
      return `🔧 Moduł ${gate.moduleLabel} jest wyłączony na tym serwerze.`;
    }
    return null;
  } catch (error) {
    logger.error(`Błąd sprawdzania moduleToggle (${commandName}): ${error}`);
    return null; // fail-open — błąd bazy nie powinien blokować komend
  }
}
