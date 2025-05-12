import { User } from 'discord.js';

export interface IParsedDateResult {
  isValid: boolean;
  date: Date | null;
  yearSpecified: boolean;
  errorMessage?: string;
}

export interface IUpcomingBirthday {
  user: User;
  date: Date;
  age: number | null;
  daysUntil: number;
}
