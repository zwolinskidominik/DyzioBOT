export interface IGuildConfig {
  roles: {
    owner: string;
    admin: string;
    mod: string;
    partnership: string;
    tournamentParticipants: string;
    tournamentOrganizer: string;
  };
  channels: {
    boostNotification: string;
    boosterList: string;
    tournamentRules: string;
    tournamentVoice: string;
  };
  tournament: {
    organizerUserIds: string[];
  };
}
