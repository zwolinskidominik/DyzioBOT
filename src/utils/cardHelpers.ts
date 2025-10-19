import { Builder, loadImage, JSX } from 'canvacord';
import type { ICardOptions, IGreetingType } from '../interfaces/Cards';
import { COLORS } from '../config/constants/colors';
import * as path from 'path';
import logger from './logger';

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

  private static imageCache = new Map<string, any>();
  private static readonly MAX_CACHE = 50;

  private static async loadImageCached(src: string) {
    if (!src) return loadImage(BLANK_PNG);
    const cached = this.imageCache.get(src);
    if (cached) return cached;

    const isDiscordCdn = src.includes('cdn.discordapp.com');
    const isLocalPath = /^(?:[A-Za-z]:\\|\/)/.test(src);

    const target = isLocalPath ? src : src;
    let img;
    try {
      img = await loadImage(target);
    } catch (err) {
      if (isDiscordCdn) {
        await new Promise((r) => setTimeout(r, 150));
        try {
          img = await loadImage(target);
        } catch (err2) {
          logger.warn(`Avatar load failed (2 próby) src=${src} -> fallback`);
          img = await loadImage(BLANK_PNG);
        }
      } else {
        logger.warn(`Image load failed src=${src} -> fallback`);
        img = await loadImage(BLANK_PNG);
      }
    }

    if (this.imageCache.size >= this.MAX_CACHE) {
      const iter = this.imageCache.keys().next();
      if (!iter.done && typeof iter.value === 'string') {
        this.imageCache.delete(iter.value);
      }
    }
    this.imageCache.set(src, img);
    return img;
  }

  public async render(): Promise<JSX.Element> {
    const { type, displayName, avatar, message, backgroundImage } = this.opts;

    let avatarImg, bgImg;
    try {
      [bgImg, avatarImg] = await Promise.all([
        GreetingsCard.loadImageCached(backgroundImage),
        GreetingsCard.loadImageCached(avatar),
      ]);
    } catch (error) {
      logger.error(`Error loading images (primary pass): ${error}`);
      try {
        bgImg = await GreetingsCard.loadImageCached(backgroundImage);
      } catch {
        bgImg = await loadImage(BLANK_PNG);
      }

      try {
        avatarImg = await GreetingsCard.loadImageCached(avatar);
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
