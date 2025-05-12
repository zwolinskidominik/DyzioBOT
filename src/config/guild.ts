import type { IGuildConfig } from '../interfaces/GuildConfig';

const MAP: Record<string, IGuildConfig> = {
  // Main Server - GameZone
  '881293681783623680': {
    roles: {
      owner: '881295973782007868',
      admin: '881295975036104766',
      mod: '1232441670193250425',
      partnership: '1290788899991584778`',
    },
    channels: {
      boostNotification: '1292423972859940966',
      boosterList: '1196291091280973895',
      tournamentRules: '1136325348246683658',
    },

    emojis: {
      next: '<:Next:1371143709672083608>',
      previous: '<:Previous:1371143725224296458>',
      birthday: '<a:bday:1341064272549249116>',
      boost: {
        list: '<a:nitro:1341055584941899776>',
        thanks: '<:thx:1341058534632067152>',
      },
      faceit: {
        levels: {
          1: '<:faceit_1lvl:1348260030750654524>',
          2: '<:faceit_2lvl:1348260039768543304>',
          3: '<:faceit_3lvl:1348260049730011137>',
          4: '<:faceit_4lvl:1348260058366218395>',
          5: '<:faceit_5lvl:1348260068470296587>',
          6: '<:faceit_6lvl:1348260077911539733>',
          7: '<:faceit_7lvl:1348260087801843853>',
          8: '<:faceit_8lvl:1348260099138785350>',
          9: '<:faceit_9level:1348260109528338534>',
          10: '<:faceit_10lvl:1348260121226121310>',
        },
        checkmark: '<:checkmark2:1371247741543387237>',
        crossmark: '<:crossmark2:1371247754084618340>',
        cry: '<:cry:1348603778613379082>',
      },
      giveaway: {
        join: '<:giveaways2:1370003636222165064>',
        list: '<:Members:1370003668861976729>',
      },
      greetings: {
        hi: '<:hi:1341059174888509521>',
        bye: '<:bye:1341059186607390770>',
      },
      suggestion: {
        upvote: '<:yes:1341047246120026254>',
        downvote: '<:no:1341047256387682456>',
      },
      suggestionPB: {
        le: '<:5499lb2g:1299663909040558160>',
        me: '<:2827l2g:1299663896218570805>',
        re: '<:2881lb3g:1299663884562468874>',
        lf: '<:5988lbg:1299663872071831622>',
        mf: '<:3451lg:1299663858914295818>',
        rf: '<:3166lb4g:1299663843827650681>',
      },
      warnPB: {
        le: '<:yleftempty:1366151068144107532>',
        me: '<:ymidempty:1366151054672007249>',
        re: '<:yrightempty:1366151038679257350>',
        lf: '<:yleftfull:1366150886497321143>',
        mf: '<:ymidfull:1366150872727294042>',
        rf: '<:yrightfull:1366150859154653184>',
      },
    },
  },

  // Test Server
  '1264582308003053570': {
    roles: {
      owner: '1264582308263100482',
      admin: '1264582308263100481',
      mod: '1264582308263100480',
      partnership: '1264582308191539249',
    },
    channels: {
      boostNotification: '1370037656402001971',
      boosterList: '1264582308552376436',
      tournamentRules: '1264582309819060246',
    },

    emojis: {
      next: '<:Next:1370886042474778725>',
      previous: '<:Previous:1370886033142579371>',
      birthday: '<a:bday:1341059858052550656>',
      boost: {
        list: '<a:nitro:1370023347861065759>',
        thanks: '<:thx:1370023375564705872>',
      },
      faceit: {
        levels: {
          1: '<:faceit_1lvl:1348036212728008735>',
          2: '<:faceit_2lvl:1348036221225406576>',
          3: '<:faceit_3lvl:1348036229521739879>',
          4: '<:faceit_4lvl:1348036238531362886>',
          5: '<:faceit_5lvl:1348036245347110932>',
          6: '<:faceit_6lvl:1348036252829618307>',
          7: '<:faceit_7lvl:1348036261503569930>',
          8: '<:faceit_8lvl:1348036268847665202>',
          9: '<:faceit_9level:1348036284706455593>',
          10: '<:faceit_10lvl:1348036292545347645>',
        },
        checkmark: '<:checkmark2:1371246698164391996>',
        crossmark: '<:crossmark2:1371246709484687440>',
        cry: '<:cry:1348444208553529364>',
      },
      giveaway: {
        join: '<:giveaways2:1366538115048669214>',
        list: '<:Members:1366155358115991602>',
      },
      greetings: {
        hi: '<:hi:1341053115134382130>',
        bye: '<:bye:1341053105302929488>',
      },
      suggestion: {
        upvote: '<:yes:1341021808375107656>',
        downvote: '<:no:1341021822208184340>',
      },
      suggestionPB: {
        le: '<:5499lb2g:1299661221263441942>',
        me: '<:2827l2g:1299661207719903305>',
        re: '<:2881lb3g:1299661195103440906>',
        lf: '<:5988lbg:1299661179148566581>',
        mf: '<:3451lg:1299661164816629782>',
        rf: '<:3166lb4g:1299661148949446668>',
      },
      warnPB: {
        le: '<:yleftempty:1364583991000170589>',
        me: '<:ymidempty:1364583999678451835>',
        re: '<:yrightempty:1364584010503819375>',
        lf: '<:yleftfull:1364583963758170153>',
        mf: '<:ymidfull:1364583972432121877>',
        rf: '<:yrightfull:1364583981684625438>',
      },
    },
  },
};

export function getGuildConfig(guildId: string): IGuildConfig {
  return (
    MAP[guildId] ?? {
      roles: { owner: '', admin: '', mod: '', partnership: '' },
      channels: { birthday: '', giveaway: '', clips: '' },
      timezone: 'UTC',
      emojis: {
        suggestionPB: MAP['1264582308003053570'].emojis.suggestionPB,
        warnPB: MAP['1264582308003053570'].emojis.warnPB,
      },
    }
  );
}
