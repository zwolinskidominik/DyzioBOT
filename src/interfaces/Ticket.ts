import { User } from 'discord.js';

export interface ITicketType {
  title: string;
  description: (user: User) => string;
  color: string;
  image: string;
}
