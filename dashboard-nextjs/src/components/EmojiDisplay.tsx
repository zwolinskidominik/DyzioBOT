import React from 'react';

interface EmojiDisplayProps {
  emoji: string;
  size?: number;
}

export function EmojiDisplay({ emoji, size = 20 }: EmojiDisplayProps) {
  // Discord custom emoji format: <:name:id> or <a:name:id>
  const discordEmojiRegex = /^<(a)?:([^:]+):(\d+)>$/;
  const match = emoji.match(discordEmojiRegex);

  if (match) {
    const [, animated, name, id] = match;
    const extension = animated ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/emojis/${id}.${extension}?size=${size * 2}&quality=lossless`;

    return (
      <img
        src={url}
        alt={name}
        title={`:${name}:`}
        className="inline-block"
        style={{ width: size, height: size }}
      />
    );
  }

  // Unicode emoji - display as is
  return <span className="inline-block" style={{ fontSize: size }}>{emoji}</span>;
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
