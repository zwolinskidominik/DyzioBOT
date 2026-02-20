import { Client, ClientEvents } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger';

export type EventHandlerFn<E extends keyof ClientEvents> = (
  ...args: [...ClientEvents[E], Client]
) => void | boolean | Promise<void | boolean>;

export class EventHandler {
  private readonly client: Client;

  public constructor(client: Client) {
    this.client = client;
    this.loadEvents().catch((err) => logger.error(`❌ Error loading events: ${err}`));
  }

  private async loadEvents(): Promise<void> {
    const eventsDir = join(__dirname, '..', 'events');
    try {
      for (const dir of readdirSync(eventsDir)) {
        const eventPath = join(eventsDir, dir);
        if (!statSync(eventPath).isDirectory()) continue;

        const eventName = dir as keyof ClientEvents;
        const handlers: EventHandlerFn<typeof eventName>[] = [];

        for (const file of readdirSync(eventPath)) {
          if (
            !/(?:\.c?js|\.mjs|\.ts)$/.test(file) ||
            file.endsWith('.d.ts') ||
            file.endsWith('.map')
          )
            continue;
          try {
            const mod = require(join(eventPath, file));
            if (typeof mod.default === 'function') handlers.push(mod.default);
            else logger.warn(`❕ Plik eventu ${file} nie eksportuje domyślnej funkcji.`);
          } catch (err) {
            logger.warn(`❌ Błąd ładowania eventu ${file}: ${err}`);
          }
        }
        if (!handlers.length) continue;

        this.client.on(eventName, async (...args: ClientEvents[typeof eventName]) => {
          for (const handler of handlers) {
            try {
              const result = await handler(
                ...([...args, this.client] as Parameters<typeof handler>)
              );
              if (result === true) break;
            } catch (err) {
              logger.error(`❌ Błąd w obsłudze eventu "${eventName}": ${err}`);
            }
          }
        });
      }
    } catch (err) {
      logger.error(`❌ Error loading events: ${err}`);
    }
  }
}
