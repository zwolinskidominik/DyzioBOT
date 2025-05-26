import { Builder, loadImage, JSX } from 'canvacord';
import type { ICardOptions, IGreetingType } from '../interfaces/Cards';
import { COLORS } from '../config/constants/colors';
import * as path from 'path';

const BLANK_PNG = path.resolve(__dirname, '../../assets/bg.jpg');

export class GreetingsCard extends Builder {
  private opts: ICardOptions;

  constructor() {
    super(930, 280);

    this.opts = {
      type: 'welcome',
      displayName: '',
      avatar: BLANK_PNG,
      message: '',
      backgroundImage: path.resolve(__dirname, '../../assets/bg.jpg'),
    };

    this.bootstrap(this.opts as unknown as Record<string, unknown>);
  }

  public setType(v: IGreetingType): this {
    this.opts.type = v;
    this.options.set('type', v);
    return this;
  }

  public setDisplayName(v: string): this {
    this.opts.displayName = v;
    this.options.set('displayName', v);
    return this;
  }

  public setAvatar(v: string | null | undefined): this {
    this.opts.avatar = v || BLANK_PNG;
    this.options.set('avatar', this.opts.avatar);
    return this;
  }

  public setMessage(v: string): this {
    this.opts.message = v;
    this.options.set('message', v);
    return this;
  }

  private static async safeLoad(src: string) {
    try {
      if (src.includes('cdn.discordapp.com')) {
        return await this.loadWithRetry(src);
      }

      if (src.startsWith('/') || src.includes(':\\')) {
        return await loadImage(BLANK_PNG);
      }

      return await loadImage(src);
    } catch (error) {
      console.error(`Failed to load image from ${src}:`, error);
      return await loadImage(BLANK_PNG);
    }
  }

  private static async loadWithRetry(src: string, retries = 3) {
    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await loadImage(src);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    console.error(`All retries failed for ${src}:`, lastError);
    return await loadImage(BLANK_PNG);
  }

  public async render(): Promise<JSX.Element> {
    const { type, displayName, avatar, message, backgroundImage } = this.opts;

    let avatarImg, bgImg;
    try {
      [bgImg, avatarImg] = await Promise.all([
        GreetingsCard.safeLoad(backgroundImage),
        GreetingsCard.safeLoad(avatar),
      ]);
    } catch (error) {
      console.error('Error loading images:', error);
      try {
        bgImg = await GreetingsCard.safeLoad(backgroundImage);
      } catch {
        bgImg = await loadImage(BLANK_PNG);
      }

      try {
        avatarImg = await GreetingsCard.safeLoad(avatar);
      } catch {
        avatarImg = await loadImage(BLANK_PNG);
      }
    }

    const accent = type === 'welcome' ? COLORS.JOIN : COLORS.LEAVE;
    const greet = type === 'welcome' ? 'Cześć' : 'Żegnaj';

    return JSX.createElement(
      'div',
      {
        className:
          'h-full w-full flex flex-col items-center justify-center bg-[#23272A] rounded-xl',
        style: {
          backgroundImage: `url(${bgImg.toDataURL()})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        },
      },
      JSX.createElement(
        'div',
        {
          className: 'px-6 bg-[#2B2F35] w-[96%] h-[84%] rounded-lg flex items-center',
          style: { opacity: 0.95 },
        },
        JSX.createElement('img', {
          src: avatarImg.toDataURL(),
          className: 'h-[40] w-[40] rounded-full',
        }),
        JSX.createElement(
          'div',
          { className: 'flex flex-col ml-6' },
          JSX.createElement(
            'h1',
            { className: 'text-5xl text-white font-bold m-0' },
            `${greet}, `,
            JSX.createElement('span', { style: { color: accent } }, `${displayName}!`)
          ),
          JSX.createElement('p', { className: 'text-gray-300 text-3xl m-0 mt-2' }, message)
        )
      )
    );
  }
}
