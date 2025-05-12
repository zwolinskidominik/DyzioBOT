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
  emojis: {
    birthday: string;
    boost: {
      list: string;
      thanks: string;
    };
    faceit: {
      levels: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10, string>;
      checkmark: string;
      crossmark: string;
      cry: string;
    };
    giveaway: {
      join: string;
      list: string;
    };
    greetings: {
      hi: string;
      bye: string;
    };
    next: string;
    previous: string;
    suggestion: {
      upvote: string;
      downvote: string;
    };
    suggestionPB: IProgressBarSet;
    warnPB: IProgressBarSet;
  };
}

export interface IProgressBarSet {
  le: string;
  me: string;
  re: string;
  lf: string;
  mf: string;
  rf: string;
}
