export type IGreetingType = 'welcome' | 'goodbye';

export interface ICardOptions {
  type: IGreetingType;
  displayName: string;
  avatar: string;
  message: string;
  backgroundImage: string;
}
