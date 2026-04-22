/**
 * Generates wordle-words-{5,6,7}.json containing only Polish lemmas
 * (base forms: nominative singular for nouns, infinitive for verbs).
 *
 * Strategy:
 *   1. Extract distinct lemmas from polimorfologik-2.1.txt (column 2 of CSV).
 *   2. Use frequency list to rank lemmas by popularity.
 *   3. Take top SAMPLE_PER_LENGTH per length.
 *
 * Sources:
 *   - polimorfologik-2.1.txt — https://github.com/morfologik/polimorfologik (rel. 2.1)
 *     Format per line:  "forma;lemat;tagi"
 *   - polish-freq.txt        — https://github.com/hermitdave/FrequencyWords (pl_50k)
 *
 * Run:
 *   npx tsx src/scripts/generateWordleJsons.ts polimorf/polimorfologik-2.1.txt polish-freq.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const POLISH_REGEX = /^[a-ząćęłńóśźż]+$/;
const VOWELS = /[aeiouyąęó]/;
const TARGET_LENGTHS = [5, 6, 7] as const;
const SAMPLE_PER_LENGTH = 1000;

// Substantywizowane zaimki/formy zlematyzowane jako rzeczowniki w polimorfologik,
// ale w faktycznym użyciu pełnią rolę zaimka/przysłówka — nie nadają się na hasło.
const PRONOUN_BLACKLIST = new Set([
  'nasze', 'wasze', 'moje', 'twoje', 'swoje', 'jego', 'ich', 'jej',
  'tamto', 'tamte', 'tamci', 'jacy', 'jakie', 'które', 'którzy',
  'bandy', 'biała', 'biały', 'czarny', 'czarna', 'zielony', 'zielona',
  'bliscy', 'starzy', 'młodzi', 'dorośli',
]);

async function loadLemmas(polimorfPath: string): Promise<Set<string>> {
  // Akceptujemy lemat tylko jeśli istnieje linia "lemma;lemma;<tag>", gdzie <tag>
  // odpowiada formie podstawowej:
  //   - subst lub adj w sg:nom (mianownik liczby pojedynczej)
  //   - verb:inf  (bezokolicznik czasownika)
  //   - ger      (rzeczownik odsłowny)
  // To eliminuje formy odmienione (np. „córką”), partykuły, zaimki, spójniki itp.
  const out = new Set<string>();
  const stream = fs.createReadStream(polimorfPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length < 3) continue;
    const lemmaRaw = parts[0].trim();
    const formRaw = parts[1].trim();
    if (lemmaRaw !== formRaw) continue;
    // Pomiń nazwy własne (zaczynają się wielką literą).
    if (lemmaRaw && lemmaRaw[0] !== lemmaRaw[0].toLowerCase()) continue;
    const lemma = lemmaRaw.toLowerCase();
    if (!POLISH_REGEX.test(lemma)) continue;
    if (PRONOUN_BLACKLIST.has(lemma)) continue;
    const tagsField = parts[2];
    let isBaseForm = false;
    for (const segment of tagsField.split('+')) {
      if (segment.startsWith('verb:inf') || segment === 'ger' || segment.startsWith('ger:')) {
        isBaseForm = true;
        break;
      }
      if (
        (segment.startsWith('subst:') || segment.startsWith('adj:')) &&
        segment.includes(':sg:') &&
        segment.includes(':nom')
      ) {
        isBaseForm = true;
        break;
      }
    }
    if (isBaseForm) out.add(lemma);
  }
  return out;
}

function loadFrequencyOrder(freqPath: string): string[] {
  const raw = fs.readFileSync(freqPath, 'utf-8');
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const word = line.split(/\s+/)[0]?.trim().toLowerCase();
    if (word && POLISH_REGEX.test(word)) out.push(word);
  }
  return out;
}

function passesQuality(word: string): boolean {
  if (!VOWELS.test(word)) return false;
  if (new Set(word).size < Math.ceil(word.length * 0.6)) return false;
  return true;
}

async function main(): Promise<void> {
  const polimorfPath = process.argv[2] ?? 'polimorf/polimorfologik-2.1.txt';
  const freqPath = process.argv[3] ?? 'polish-freq.txt';
  if (!fs.existsSync(polimorfPath) || !fs.existsSync(freqPath)) {
    console.error(`Brak plików źródłowych: ${polimorfPath}, ${freqPath}`);
    process.exit(1);
  }

  console.log('Wczytuję lematy z polimorfologik (to chwilę zajmie)…');
  const lemmas = await loadLemmas(polimorfPath);
  console.log(`Lemm: ${lemmas.size}`);

  const freqOrder = loadFrequencyOrder(freqPath);
  console.log(`Pozycji frekwencji: ${freqOrder.length}`);

  const buckets: Record<number, string[]> = {};
  const seen: Record<number, Set<string>> = {};
  for (const len of TARGET_LENGTHS) {
    buckets[len] = [];
    seen[len] = new Set();
  }

  // 1) Najpopularniejsze lematy w kolejności frekwencji.
  for (const word of freqOrder) {
    const len = word.length;
    if (!TARGET_LENGTHS.includes(len as (typeof TARGET_LENGTHS)[number])) continue;
    if (!lemmas.has(word)) continue;
    if (!passesQuality(word)) continue;
    if (seen[len].has(word)) continue;
    if (buckets[len].length >= SAMPLE_PER_LENGTH) continue;
    buckets[len].push(word);
    seen[len].add(word);
  }

  // 2) Uzupełnij brakujące pozostałymi lematami (alfabetycznie).
  const remainingLemmas = [...lemmas].sort();
  for (const word of remainingLemmas) {
    const len = word.length;
    if (!TARGET_LENGTHS.includes(len as (typeof TARGET_LENGTHS)[number])) continue;
    if (!passesQuality(word)) continue;
    if (seen[len].has(word)) continue;
    if (buckets[len].length >= SAMPLE_PER_LENGTH) continue;
    buckets[len].push(word);
    seen[len].add(word);
  }

  for (const len of TARGET_LENGTHS) {
    const sample = buckets[len].slice().sort();
    const outPath = path.resolve(`wordle-words-${len}.json`);
    fs.writeFileSync(outPath, JSON.stringify(sample, null, 2), 'utf-8');
    console.log(`✓ ${len}-literowe: ${sample.length} lematów → ${outPath}`);
  }
}

void main();


