export interface ICS2Stats {
  lifetime: Record<string, string | string[]>;
}

export interface IFaceitPlayer {
  player_id: string;
  nickname: string;
  avatar?: string;
  country: string;
  steam_id_64?: string;
  activated_at: string;
  games?: {
    cs2?: {
      skill_level: number;
      faceit_elo?: number;
    };
    csgo?: {
      skill_level?: number;
      faceit_elo?: number;
    };
  };
}

export interface IPlayerStats {
  nickname: string;
  country: string;
  flag: string;
  avatar: string | null;
  skillLevel: number | string;
  faceitElo: number | string;
  accountCreatedTimestamp: number;
  matches: string;
  winRate: string;
  recentResults: string[];
  longestWinStreak: string;
  averageKills: string;
  averageHeadshots: string;
  kdRatio: string;
}
