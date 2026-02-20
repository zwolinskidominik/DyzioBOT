"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface CustomEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  guildId: string;
  guildName: string;
}

interface EmojiContextValue {
  customEmojis: CustomEmoji[];
  loading: boolean;
  loaded: boolean;
  fetchEmojis: () => Promise<void>;
}

const EmojiContext = createContext<EmojiContextValue>({
  customEmojis: [],
  loading: false,
  loaded: false,
  fetchEmojis: async () => {},
});

export function EmojiProvider({ children }: { children: ReactNode }) {
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchEmojis = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/discord/user/emojis");
      if (response.ok) {
        const emojis = await response.json();
        setCustomEmojis(emojis);
        setLoaded(true);
      }
    } catch (error) {
      console.error("Failed to fetch custom emojis:", error);
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  return (
    <EmojiContext.Provider value={{ customEmojis, loading, loaded, fetchEmojis }}>
      {children}
    </EmojiContext.Provider>
  );
}

export function useEmojis() {
  return useContext(EmojiContext);
}
