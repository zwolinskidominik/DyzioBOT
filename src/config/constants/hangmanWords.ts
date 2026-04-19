/**
 * Hangman game types and constants.
 * Word data is stored in MongoDB (collection: hangmancategories).
 */

export interface HangmanCategory {
  name: string;
  emoji: string;
  words: string[];
}

export const MAX_WRONG_GUESSES = 7;
