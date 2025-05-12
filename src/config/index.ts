import 'dotenv/config';
import { EnvSchema, type Env } from './env.schema';

let cache: Env | null = null;

export function env(): Env {
  if (cache) return cache;
  cache = EnvSchema.parse(process.env);
  return cache;
}
