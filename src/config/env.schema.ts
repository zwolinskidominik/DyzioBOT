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

  TOURNAMENT_CHANNEL_ID: z.string().optional(),

  MONGODB_URI: z.string().url('MONGODB_URI musi być poprawnym URL-em'),

  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  FACEIT_API_KEY: z.string().optional(),
});

export type Env = Readonly<z.infer<typeof EnvSchema>>;
