import { z } from 'zod';

const csv = (name: string) =>
  z
    .string()
    .min(1, `Brakuje ${name} w .env`)
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    );

export const EnvSchema = z.object({
  TOKEN: z.string().min(1, 'Brakuje TOKEN w .env'),
  CLIENT_ID: z.string().min(1, 'Brakuje CLIENT_ID'),
  GUILD_ID: z.string().min(1, 'Brakuje GUILD_ID'),

  DEV_GUILD_IDS: csv('DEV_GUILD_IDS'),
  DEV_USER_IDS: csv('DEV_USER_IDS'),
  DEV_ROLE_IDS: csv('DEV_ROLE_IDS'),

  MONGODB_URI: z.string().url('MONGODB_URI musi być poprawnym URL-em'),

  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  FACEIT_API_KEY: z.string().optional(),

  /** Usuwanie danych serwerów 30 dni po usunięciu bota. Ustaw "on" TYLKO na produkcji. */
  GUILD_DATA_RETENTION: z.enum(['on', 'off']).optional(),

  /** ID konta Discord, które dostaje w DM alerty o kopiach zapasowych bazy. Brak = monitor wyłączony. */
  BACKUP_ALERT_USER_ID: z.string().regex(/^\d{17,20}$/, 'BACKUP_ALERT_USER_ID musi być ID użytkownika Discord').optional(),
  /** Katalog ze statusem kopii (montowany tylko do odczytu w docker-compose). */
  BACKUP_STATUS_DIR: z.string().optional(),
});

export type Env = Readonly<z.infer<typeof EnvSchema>>;
