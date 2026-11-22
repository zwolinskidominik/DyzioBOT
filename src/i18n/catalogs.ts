import type { Messages } from './index';
import { commonMessages } from './messages/common';

/**
 * Wszystkie słowniki bota - test sprawdza na nich, czy angielska wersja ma te same klucze co polska
 * i nie zawiera polskich znaków. Każdy nowy plik w messages/ dopisz tutaj.
 */
export const ALL_CATALOGS: Record<string, Messages<unknown>> = {
  common: commonMessages,
};
