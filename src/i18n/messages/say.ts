import { defineMessages } from '../index';

/** /say: odpowiedzi widoczne tylko dla osoby, która wysyła wiadomość. */
export const sayMessages = defineMessages({
  pl: {
    sent: 'Twoja wiadomość została wysłana',
    imageInvalid: (maxMb: number) => `Obrazek musi być plikiem PNG, JPG, GIF albo WEBP o rozmiarze do ${maxMb} MB.`,
  },
  en: {
    sent: 'Your message has been sent',
    imageInvalid: (maxMb: number) => `The image must be a PNG, JPG, GIF or WEBP file up to ${maxMb} MB.`,
  },
});
