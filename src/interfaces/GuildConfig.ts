export interface IGuildConfig {
  roles: {
    owner: string;
    admin: string;
    mod: string;
    partnership: string;
  };
  channels: {
    boostNotification: string;
    boosterList: string;
    tournamentRules: string;
  };
}
