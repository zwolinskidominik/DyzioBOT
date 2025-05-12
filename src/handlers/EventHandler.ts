import { Client, ClientEvents } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export type EventHandlerFn<E extends keyof ClientEvents> = (
  ...args: [...ClientEvents[E], Client]
) => void | boolean | Promise<void | boolean>;

export class EventHandler {
  private readonly client: Client;

  public constructor(client: Client) {
    this.client = client;
    this.loadEvents().catch(console.error);
  }

  private async loadEvents(): Promise<void> {
    const eventsDir = join(__dirname, '..', 'events');

    try {
      for (const eventFolder of readdirSync(eventsDir)) {
        const eventPath = join(eventsDir, eventFolder);

        if (!statSync(eventPath).isDirectory()) continue;

        const eventName = eventFolder as keyof ClientEvents;
        const handlers: EventHandlerFn<typeof eventName>[] = [];

        for (const file of readdirSync(eventPath)) {
          if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

          try {
            const modulePath = `../events/${eventFolder}/${file.replace(/\.(js|ts)$/, '')}`;
            const eventModule = await import(modulePath);

            if (typeof eventModule.default === 'function') {
              handlers.push(eventModule.default as EventHandlerFn<typeof eventName>);
            } else {
              console.warn(`❕ Plik eventu ${file} nie eksportuje domyślnej funkcji.`);
            }
          } catch (err) {
            console.error(`❌ Błąd ładowania eventu ${file}:`, err);
            console.error(err);
          }
        }

        if (handlers.length === 0) continue;

        this.client.on(eventName, async (...args: ClientEvents[typeof eventName]) => {
          for (const handler of handlers) {
            try {
              const handlerArgs = [...args, this.client];
              const result = await handler(...(handlerArgs as Parameters<typeof handler>));
              if (result === true) break;
            } catch (err) {
              console.error(`❌ Błąd w obsłudze eventu "${eventName}" w handlerze:`, err);
            }
          }
        });
      }
    } catch (err) {
      console.error('❌ Error loading events:', err);
      console.error(err);
    }
  }
}
