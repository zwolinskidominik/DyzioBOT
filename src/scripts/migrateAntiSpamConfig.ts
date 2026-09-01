/**
 * Jednorazowa migracja: przepisuje istniejące dokumenty `antispamconfigs` z płaskiej
 * struktury (jedna globalna akcja/próg dla całego modułu) na nową, zagnieżdżoną
 * strukturę 4 niezależnych reguł (rate/invites/mentions/repeat) wprowadzoną w redesignie
 * Anti-Spam. Bez tej migracji serwery, które miały już skonfigurowaną ochronę, straciłyby
 * ją po wdrożeniu (bot zacząłby czytać nieistniejące pola `rate`/`invites`/... i wracać
 * do domyślnych ustawień).
 *
 * Użycie:
 *   npx tsx src/scripts/migrateAntiSpamConfig.ts            (dry-run — tylko podgląd)
 *   npx tsx src/scripts/migrateAntiSpamConfig.ts --apply     (faktyczny zapis)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import type { AntiSpamPunishment } from '../models/AntiSpamConfig';

const APPLY = process.argv.includes('--apply');

const MUTE_DURATION_BUCKETS = [5, 10, 60, 1440]; // minuty

function nearestMuteDurationBucket(durationMs: number | undefined): string {
  const minutes = (durationMs ?? 5 * 60 * 1000) / 60_000;
  let best = MUTE_DURATION_BUCKETS[0];
  let bestDiff = Math.abs(minutes - best);
  for (const bucket of MUTE_DURATION_BUCKETS) {
    const diff = Math.abs(minutes - bucket);
    if (diff < bestDiff) {
      best = bucket;
      bestDiff = diff;
    }
  }
  return String(best);
}

function mapAction(oldAction: string | undefined): AntiSpamPunishment {
  if (oldAction === 'timeout') return 'mute';
  if (oldAction === 'warn' || oldAction === 'kick' || oldAction === 'ban') return oldAction;
  return 'mute';
}

interface OldFlatDoc {
  _id: unknown;
  guildId: string;
  enabled?: boolean;
  messageThreshold?: number;
  timeWindowMs?: number;
  action?: string;
  timeoutDurationMs?: number;
  deleteMessages?: boolean;
  ignoredChannels?: string[];
  ignoredRoles?: string[];
  blockInviteLinks?: boolean;
  blockMassMentions?: boolean;
  maxMentionsPerMessage?: number;
  blockFlood?: boolean;
  floodThreshold?: number;
  floodWindowMs?: number;
  blockEveryoneHere?: boolean;
  rate?: unknown; // obecność = już zmigrowany
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Brak MONGODB_URI w .env');
  }

  await mongoose.connect(uri);
  console.log('Połączono z bazą.');
  console.log(
    `Tryb: ${APPLY ? 'APPLY — zmiany zostaną zapisane' : 'DRY-RUN — tylko podgląd, nic nie zostanie zapisane'}`
  );

  const collection = mongoose.connection.collection<OldFlatDoc>('antispamconfigs');
  const docs = await collection.find({}).toArray();

  console.log(`Dokumentów w antispamconfigs: ${docs.length}`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      if (doc.rate && typeof doc.rate === 'object' && 'on' in (doc.rate as object)) {
        console.log(`  ⏩ ${doc.guildId} — już zmigrowany, pomijam`);
        skipped++;
        continue;
      }

      const muteDuration = nearestMuteDurationBucket(doc.timeoutDurationMs);
      const action = mapAction(doc.action);
      const deleteMessage = doc.deleteMessages ?? true;

      const baseRule = {
        deleteMessage,
        mode: 'single' as const,
        action,
        steps: ['warn'] as AntiSpamPunishment[],
        muteDuration,
        reset: '24',
        allowOwnServerInvites: true,
      };

      const newShape = {
        enabled: doc.enabled ?? false,
        ignoredChannels: doc.ignoredChannels ?? [],
        ignoredRoles: doc.ignoredRoles ?? [],
        rate: { ...baseRule, on: true, threshold: doc.messageThreshold ?? 5, windowSeconds: Math.round((doc.timeWindowMs ?? 3000) / 1000) },
        invites: { ...baseRule, on: doc.blockInviteLinks ?? false, threshold: 5, windowSeconds: 3 },
        // Stary system miał DWA osobne przełączniki: blockMassMentions (dużo @user/@role
        // w jednej wiadomości) i blockEveryoneHere (@everyone/@here, domyślnie WŁĄCZONE
        // i faktycznie egzekwowane przez starego handlera). Nowa reguła "mentions" łączy
        // oba w jeden toggle — pomijanie blockEveryoneHere wyłączyłoby domyślnie aktywną
        // ochronę przed @everyone/@here na każdym serwerze, który jej nigdy nie dotykał.
        mentions: {
          ...baseRule,
          on: (doc.blockMassMentions ?? false) || (doc.blockEveryoneHere ?? true),
          threshold: doc.maxMentionsPerMessage ?? 5,
          windowSeconds: 3,
        },
        repeat: { ...baseRule, on: doc.blockFlood ?? false, threshold: doc.floodThreshold ?? 3, windowSeconds: Math.round((doc.floodWindowMs ?? 30_000) / 1000) },
      };

      console.log(`  ✓ ${doc.guildId} → enabled=${newShape.enabled}, rate.on=true, invites.on=${newShape.invites.on}, mentions.on=${newShape.mentions.on}, repeat.on=${newShape.repeat.on}`);

      if (APPLY) {
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: newShape,
            $unset: {
              messageThreshold: '',
              timeWindowMs: '',
              action: '',
              timeoutDurationMs: '',
              deleteMessages: '',
              blockInviteLinks: '',
              blockMassMentions: '',
              maxMentionsPerMessage: '',
              blockEveryoneHere: '',
              blockFlood: '',
              floodThreshold: '',
              floodWindowMs: '',
            },
          }
        );
      }

      migrated++;
    } catch (error) {
      console.error(`  ✗ Błąd dla ${doc.guildId}: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log('\n=== Podsumowanie ===');
  console.log(`Do migracji: ${migrated}`);
  console.log(`Już zmigrowane (pominięte): ${skipped}`);
  console.log(`Błędów: ${failed}`);

  if (!APPLY) {
    console.log('\nTo był dry-run — żadne dane nie zostały zmienione.');
    console.log('Żeby faktycznie zapisać zmiany, uruchom:');
    console.log('  npx tsx src/scripts/migrateAntiSpamConfig.ts --apply');
  } else {
    console.log('\nZmiany zostały zapisane.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Błąd migracji:', error);
  process.exit(1);
});
