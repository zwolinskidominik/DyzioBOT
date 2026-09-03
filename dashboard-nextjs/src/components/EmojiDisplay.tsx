import React, { useState } from 'react';
import { twemojiAssetPath } from '@/lib/emojiCodepoints';

interface EmojiDisplayProps {
  emoji: string;
  size?: number;
}

export function EmojiDisplay({ emoji, size = 20 }: EmojiDisplayProps) {
  const [imgError, setImgError] = useState(false);

  // Discord custom emoji format: <:name:id> or <a:name:id>
  const discordEmojiRegex = /^<(a)?:([^:]+):(\d+)>$/;
  const match = emoji.match(discordEmojiRegex);

  if (match) {
    const [, animated, name, id] = match;

    if (imgError) {
      // Emoji deleted or bot has no access — show fallback
      return (
        <span
          className="inline-block text-muted-foreground"
          style={{ fontSize: size * 0.75 }}
          title={`:${name}: (emoji niedostępne)`}
        >
          ❓
        </span>
      );
    }

    const extension = animated ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/emojis/${id}.${extension}?size=${size * 2}&quality=lossless`;

    return (
      <img
        src={url}
        alt={name}
        title={`:${name}:`}
        className="inline-block"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  // Unicode emoji — renderowane jako obraz Twemoji (ten sam zestaw grafik co Discord),
  // żeby wyglądało identycznie niezależnie od czcionki systemowej. Self-hosted z
  // public/twemoji/svg/ — CSP img-src celowo nie zezwala na zewnętrzne CDN (jsDelivr
  // itp.), patrz next.config.ts. Fallback do glifu natywnego, jeśli plik nie istnieje
  // (emoji spoza naszego datasetu) albo się nie załaduje.
  if (imgError) {
    return <span className="inline-block" style={{ fontSize: size }}>{emoji}</span>;
  }

  const assetPath = twemojiAssetPath(emoji);
  if (!assetPath) {
    return <span className="inline-block" style={{ fontSize: size }}>{emoji}</span>;
  }

  return (
    <img
      src={assetPath}
      alt={emoji}
      className="inline-block align-middle"
      style={{ width: size, height: size }}
      draggable={false}
      onError={() => setImgError(true)}
    />
  );
}

interface EmojiListProps {
  emojis: string[];
  size?: number;
  separator?: string;
}

export function EmojiList({ emojis, size = 20, separator = ', ' }: EmojiListProps) {
  return (
    <>
      {emojis.map((emoji, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>{separator}</span>}
          <EmojiDisplay emoji={emoji} size={size} />
        </React.Fragment>
      ))}
    </>
  );
}

/** Returns true if any of the emoji strings is a Discord custom emoji (any <:name:id>) */
export function hasCustomEmoji(reactions: string[]): boolean {
  return reactions.some((r) => /^<a?:[^:]+:\d+>$/.test(r));
}

/**
 * Extracts the snowflake ID from a Discord custom emoji string "<:name:id>" or "<a:name:id>".
 * Returns null for unicode emoji.
 */
export function getCustomEmojiId(emoji: string): string | null {
  const m = emoji.match(/^<a?:[^:]+:(\d+)>$/);
  return m ? m[1] : null;
}

/**
 * Returns true if the reactions array contains at least one custom Discord emoji
 * whose ID is NOT in the provided set of known bot emoji IDs.
 *
 * - null  → list not loaded yet, return false (avoid flicker on initial render)
 * - empty Set → list failed to load or bot has no emojis, conservatively flag all custom emojis
 * - non-empty Set → flag only emojis whose IDs are not in the set
 */
export function hasExternalEmoji(reactions: string[], botEmojiIds: ReadonlySet<string> | null): boolean {
  if (botEmojiIds === null) {
    // Still loading — don't flag anything yet
    return false;
  }
  if (botEmojiIds.size === 0) {
    // List loaded but empty (API failed or bot has no custom emojis) — flag all custom emojis
    return hasCustomEmoji(reactions);
  }
  return reactions.some((r) => {
    const id = getCustomEmojiId(r);
    return id !== null && !botEmojiIds.has(id);
  });
}

