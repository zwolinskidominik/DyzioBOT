import type { GuildEmoji } from 'discord.js';

export interface IEmojiAddResult {
  token: string;
  success: boolean;
  emoji?: GuildEmoji;
  error?: string;
}

export interface IEmojiMatch {
  animated: string;
  name: string;
  id: string;
}
