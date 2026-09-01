/**
 * Kopia mapowania emoji z `src/config/bot.ts` (bot Discord — osobny projekt Node.js, poza tym
 * repo Next.js, więc nie da się go bezpośrednio zaimportować). MUSI być ręcznie zsynchronizowana
 * z `src/config/bot.ts` / `src/interfaces/BotConfig.ts` przy każdej zmianie configu emoji bota —
 * ten sam wzorzec co `EVENT_LABELS` w `app/api/guild/[guildId]/logs/config/route.ts`.
 *
 * Używane przez moduł „Emoji Bota", żeby dla każdego realnego emoji z Discord Application Emojis
 * pokazać, czy (i pod jakim kluczem) jest wpięte w config bota — i zablokować usunięcie takiego
 * emoji, bo zepsułoby to działający moduł.
 */

type EmojiTree = { [key: string]: string | EmojiTree };

const MAIN_BOT_ID = "1119327417237000285";
const TEST_BOT_ID = "1248419676740915310";

const BOT_EMOJIS: Record<string, EmojiTree> = {
  [MAIN_BOT_ID]: {
    next: "<:Next:1371143709672083608>",
    previous: "<:Previous:1371143725224296458>",
    birthday: "<a:bday:1341064272549249116>",
    boost: { list: "<a:nitro:1341055584941899776>", thanks: "<:thx:1341058534632067152>" },
    faceit: {
      levels: {
        "1": "<:faceit_1lvl:1348260030750654524>",
        "2": "<:faceit_2lvl:1348260039768543304>",
        "3": "<:faceit_3lvl:1348260049730011137>",
        "4": "<:faceit_4lvl:1348260058366218395>",
        "5": "<:faceit_5lvl:1348260068470296587>",
        "6": "<:faceit_6lvl:1348260077911539733>",
        "7": "<:faceit_7lvl:1348260087801843853>",
        "8": "<:faceit_8lvl:1348260099138785350>",
        "9": "<:faceit_9level:1348260109528338534>",
        "10": "<:faceit_10lvl:1348260121226121310>",
      },
      checkmark: "<:checkmark2:1371247741543387237>",
      crossmark: "<:crossmark2:1371247754084618340>",
      cry: "<:cry:1348603778613379082>",
    },
    giveaway: { join: "<:giveaways2:1370003636222165064>", list: "<:Members:1370003668861976729>" },
    greetings: { hi: "<:hi:1341059174888509521>", bye: "<:bye:1341059186607390770>" },
    monthlyStats: {
      upvote: "<:upvote:1439073640149946418>",
      downvote: "<:downvote:1439073641760424027>",
      whitedash: "<:whitedash:1439073675516051536>",
      new: "<:52690newred:1439641798187159612>",
    },
    suggestion: { upvote: "<:yes:1341047246120026254>", downvote: "<:no:1341047256387682456>" },
    suggestionPB: {
      le: "<:5499lb2g:1299663909040558160>",
      me: "<:2827l2g:1299663896218570805>",
      re: "<:2881lb3g:1299663884562468874>",
      lf: "<:5988lbg:1299663872071831622>",
      mf: "<:3451lg:1299663858914295818>",
      rf: "<:3166lb4g:1299663843827650681>",
    },
    trophy: {
      gold: "<:trophy1:1439071783633293322>",
      silver: "<:trophy2:1439071785172865055>",
      bronze: "<:trophy3:1439071786594467840>",
    },
    warnPB: {
      le: "<:yleftempty:1366151068144107532>",
      me: "<:ymidempty:1366151054672007249>",
      re: "<:yrightempty:1366151038679257350>",
      lf: "<:yleftfull:1366150886497321143>",
      mf: "<:ymidfull:1366150872727294042>",
      rf: "<:yrightfull:1366150859154653184>",
    },
  },
  [TEST_BOT_ID]: {
    next: "<:Next:1370886042474778725>",
    previous: "<:Previous:1370886033142579371>",
    birthday: "<a:bday:1341059858052550656>",
    boost: { list: "<a:nitro:1370023347861065759>", thanks: "<:thx:1370023375564705872>" },
    faceit: {
      levels: {
        "1": "<:faceit_1lvl:1348036212728008735>",
        "2": "<:faceit_2lvl:1348036221225406576>",
        "3": "<:faceit_3lvl:1348036229521739879>",
        "4": "<:faceit_4lvl:1348036238531362886>",
        "5": "<:faceit_5lvl:1348036245347110932>",
        "6": "<:faceit_6lvl:1348036252829618307>",
        "7": "<:faceit_7lvl:1348036261503569930>",
        "8": "<:faceit_8lvl:1348036268847665202>",
        "9": "<:faceit_9level:1348036284706455593>",
        "10": "<:faceit_10lvl:1348036292545347645>",
      },
      checkmark: "<:checkmark2:1371246698164391996>",
      crossmark: "<:crossmark2:1371246709484687440>",
      cry: "<:cry:1348444208553529364>",
    },
    giveaway: { join: "<:giveaways2:1366538115048669214>", list: "<:Members:1366155358115991602>" },
    greetings: { hi: "<:hi:1341053115134382130>", bye: "<:bye:1341053105302929488>" },
    monthlyStats: {
      upvote: "<:upvote:1436123564913725660>",
      downvote: "<:downvote:1436123566310686850>",
      whitedash: "<:whitedash:1436123971664875711>",
      new: "<:52690newred:1439422826636644504>",
    },
    suggestion: { upvote: "<:yes:1341021808375107656>", downvote: "<:no:1341021822208184340>" },
    suggestionPB: {
      le: "<:5499lb2g:1299661221263441942>",
      me: "<:2827l2g:1299661207719903305>",
      re: "<:2881lb3g:1299661195103440906>",
      lf: "<:5988lbg:1299661179148566581>",
      mf: "<:3451lg:1299661164816629782>",
      rf: "<:3166lb4g:1299661148949446668>",
    },
    trophy: {
      gold: "<:trophy1:1435031695211364413>",
      silver: "<:trophy2:1435031697149137047>",
      bronze: "<:trophy3:1435031698621595820>",
    },
    warnPB: {
      le: "<:yleftempty:1364583991000170589>",
      me: "<:ymidempty:1364583999678451835>",
      re: "<:yrightempty:1364584010503819375>",
      lf: "<:yleftfull:1364583963758170153>",
      mf: "<:ymidfull:1364583972432121877>",
      rf: "<:yrightfull:1364583981684625438>",
    },
  },
};

/** Polskie etykiety grup dla kluczy najwyższego poziomu drzewa emoji configu. */
export const EMOJI_GROUP_LABELS: Record<string, string> = {
  next: "Nawigacja",
  previous: "Nawigacja",
  birthday: "Urodziny",
  boost: "Boosty",
  faceit: "FACEIT",
  giveaway: "Giveaway",
  greetings: "Powitania",
  monthlyStats: "Statystyki miesięczne",
  suggestion: "Sugestie",
  suggestionPB: "Pasek postępu sugestii",
  trophy: "Podium",
  warnPB: "Pasek ostrzeżeń",
  none: "Bez odwołania",
};

function parseMention(mention: string): { animated: boolean; name: string; id: string } | null {
  const match = mention.match(/^<(a)?:([^:]+):(\d+)>$/);
  if (!match) return null;
  return { animated: Boolean(match[1]), name: match[2], id: match[3] };
}

export interface EmojiConfigEntry {
  key: string;
  group: string;
  groupLabel: string;
}

function flatten(
  tree: EmojiTree,
  topLevelKey: string,
  path: string[],
  out: Map<string, EmojiConfigEntry>
): void {
  for (const [k, v] of Object.entries(tree)) {
    const nextPath = [...path, k];
    if (typeof v === "string") {
      const parsed = parseMention(v);
      if (parsed) {
        out.set(parsed.id, {
          key: nextPath.join("."),
          group: topLevelKey,
          groupLabel: EMOJI_GROUP_LABELS[topLevelKey] ?? topLevelKey,
        });
      }
    } else {
      flatten(v, topLevelKey, nextPath, out);
    }
  }
}

/** Discord emoji ID -> {key, group, groupLabel} dla configu danego bota (fallback jak w bocie: test bot). */
export function getEmojiConfigMap(botId: string | undefined): Map<string, EmojiConfigEntry> {
  const tree = (botId && BOT_EMOJIS[botId]) || BOT_EMOJIS[TEST_BOT_ID];
  const out = new Map<string, EmojiConfigEntry>();

  for (const [topLevelKey, subtree] of Object.entries(tree)) {
    if (typeof subtree === "string") {
      const parsed = parseMention(subtree);
      if (parsed) {
        out.set(parsed.id, {
          key: topLevelKey,
          group: topLevelKey,
          groupLabel: EMOJI_GROUP_LABELS[topLevelKey] ?? topLevelKey,
        });
      }
    } else {
      flatten(subtree, topLevelKey, [topLevelKey], out);
    }
  }

  return out;
}
