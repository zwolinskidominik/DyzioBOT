import { EventEmitter } from 'events';
import { Client, GuildMember, VoiceState, Message, User, GuildChannel, Guild } from 'discord.js';
import logger from '../../../src/utils/logger';

export class EventHarness extends EventEmitter {
  private static instance: EventHarness | null = null;
  private client: Client | null = null;
  private eventTracker: Map<string, number> = new Map();
  private readonly eventQueue: Array<{ event: string; data: any[]; timestamp: number }> = [];
  private processingEvents = false;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): EventHarness {
    if (!EventHarness.instance) {
      EventHarness.instance = new EventHarness();
    }
    return EventHarness.instance;
  }

  public reset(): void {
    this.removeAllListeners();
    this.eventTracker.clear();
    this.eventQueue.length = 0;
    this.processingEvents = false;
    this.client = null;
  }

  public setClient(client: Client): void {
    this.client = client;
  }

  public async emitEvent(event: string, ...args: any[]): Promise<boolean> {
    if (!this.client) {
      throw new Error('Client nie został ustawiony. Użyj setClient() przed emitowaniem zdarzeń.');
    }

    const count = this.eventTracker.get(event) || 0;
    this.eventTracker.set(event, count + 1);

    this.eventQueue.push({
      event,
      data: args,
      timestamp: Date.now()
    });

    const result = this.client.emit(event, ...args);

    super.emit(event, ...args);
    super.emit('eventEmitted', { event, args, timestamp: Date.now() });

    setTimeout(() => {
      this.eventQueue.length = 0;
    }, 10);

    return result;
  }

  public async waitFor(
    event: string,
    predicate?: (...args: any[]) => boolean,
    timeout = 5000
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener(event, handler);
        reject(new Error(`Timeout oczekiwania na zdarzenie '${event}' (${timeout}ms)`));
      }, timeout);

      const handler = (...args: any[]) => {
        if (!predicate || predicate(...args)) {
          clearTimeout(timeoutId);
          this.removeListener(event, handler);
          resolve(args);
        }
      };

      this.on(event, handler);
    });
  }

  public async waitForProcessing(timeout = 10000): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout oczekiwania na przetworzenie zdarzeń (${timeout}ms)`));
      }, timeout);

      const checkProcessing = () => {
        if (!this.processingEvents && this.eventQueue.length === 0) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkProcessing, 50);
        }
      };

      checkProcessing();
    });
  }

  public clearEventQueue(): void {
    this.eventQueue.length = 0;
  }

  public getEventCount(event: string): number {
    return this.eventTracker.get(event) || 0;
  }

  public getEventStats(): Record<string, number> {
    return Object.fromEntries(this.eventTracker);
  }

  public getEventQueue(): Array<{ event: string; data: any[]; timestamp: number }> {
    return [...this.eventQueue];
  }

  public async emitReady(client?: Client): Promise<void> {
    const targetClient = client || this.client;
    if (!targetClient) {
      throw new Error('Client nie został ustawiony');
    }

    await this.emitEvent('clientReady', targetClient);
  }

  public async emitGuildMemberAdd(member: GuildMember): Promise<void> {
    await this.emitEvent('guildMemberAdd', member);
  }

  public async emitGuildMemberRemove(member: GuildMember): Promise<void> {
    await this.emitEvent('guildMemberRemove', member);
  }

  public async emitGuildMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    await this.emitEvent('guildMemberUpdate', oldMember, newMember);
  }

  public async emitVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    await this.emitEvent('voiceStateUpdate', oldState, newState);
  }

  public async emitMessageCreate(message: Message): Promise<void> {
    await this.emitEvent('messageCreate', message);
  }

  public async emitMessageUpdate(oldMessage: Message | null, newMessage: Message): Promise<void> {
    await this.emitEvent('messageUpdate', oldMessage, newMessage);
  }

  public async emitMessageDelete(message: Message): Promise<void> {
    await this.emitEvent('messageDelete', message);
  }

  public async emitMessageReactionAdd(reaction: any, user: User): Promise<void> {
    await this.emitEvent('messageReactionAdd', reaction, user);
  }

  public async emitChannelDelete(channel: GuildChannel): Promise<void> {
    await this.emitEvent('channelDelete', channel);
  }

  public async emitGuildDelete(guild: Guild): Promise<void> {
    await this.emitEvent('guildDelete', guild);
  }

  public async emitBatch(events: Array<{
    type: string;
    args: any[];
    delay?: number;
  }>): Promise<void> {
    this.processingEvents = true;

    try {
      for (const eventData of events) {
        if (eventData.delay) {
          await new Promise(resolve => setTimeout(resolve, eventData.delay));
        }
        await this.emitEvent(eventData.type, ...eventData.args);
      }
      
      this.eventQueue.length = 0;
    } finally {
      this.processingEvents = false;
    }
  }

  public async simulateUserJoiningVoice(
    member: GuildMember,
    oldState: VoiceState,
    newState: VoiceState
  ): Promise<void> {
    await this.emitBatch([
      {
        type: 'voiceStateUpdate',
        args: [oldState, newState],
        delay: 0
      }
    ]);
  }

  public async simulateNewUserFlow(member: GuildMember): Promise<void> {
    await this.emitBatch([
      {
        type: 'guildMemberAdd',
        args: [member],
        delay: 0
      },
      {
        type: 'guildMemberUpdate', 
        args: [member, member],
        delay: 100
      }
    ]);
  }

  public async simulateServerBoost(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    await this.emitBatch([
      {
        type: 'guildMemberUpdate',
        args: [oldMember, newMember],
        delay: 0
      }
    ]);
  }

  public getActiveListeners(): Record<string, number> {
    const listeners: Record<string, number> = {};
    for (const event of this.eventNames()) {
      listeners[event.toString()] = this.listenerCount(event);
    }
    return listeners;
  }

  public clearEventListeners(event: string): void {
    this.removeAllListeners(event);
  }
}

export function createEventHarness(): EventHarness {
  return EventHarness.getInstance();
}

export function resetEventHarness(): void {
  const harness = EventHarness.getInstance();
  harness.reset();
}

export default EventHarness;