import { EmbedBuilder } from 'discord.js';

export interface IBaseEmbedOptions {
  isError?: boolean;
  color?: string;
  title?: string;
  description?: string;
  footerText?: string;
  footerIcon?: string;
  image?: string;
  thumbnail?: string;
  authorName?: string;
  authorIcon?: string;
  authorUrl?: string;
  url?: string;
  timestamp?: boolean;
}

export interface IEmbedData {
  embed: EmbedBuilder;
  totalPages: number;
}

export interface IEmbedField {
  title: string | null;
  description: string | null;
}
