import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import dbConnect from '@/lib/mongodb';
import WordleWord from '@/models/WordleWord';
import mongoose from 'mongoose';
import { getApiMessages } from '@/i18n/apiServer';

// Polskie litery bez q, v, x — zgodnie z klawiaturą Wordle w bocie.
const POLISH_REGEX = /^[a-pr-uwyząćęłńóśźż]+$/;
const MIN_LEN = 5;
const MAX_LEN = 7;

/* ── GET — return all words grouped by length ─────────────── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await dbConnect();

    // mongoose.trusted(): sanitizeFilter (instrumentation.ts) sanityzuje każdy
    // operator w ręcznie pisanym filtrze — bez tego rzuca CastError na $gte/$lte.
    const words = await WordleWord.find({
      length: mongoose.trusted({ $gte: MIN_LEN, $lte: MAX_LEN }),
    })
      .lean()
      .sort({ length: 1, word: 1 });

    // Group by length
    const grouped: Record<number, string[]> = {};
    for (const w of words as any[]) {
      if (!grouped[w.length]) grouped[w.length] = [];
      grouped[w.length].push(w.word);
    }

    const categories = Object.entries(grouped).map(([len, ws]) => ({
      length: Number(len),
      words: ws,
      wordCount: ws.length,
    }));

    return NextResponse.json({
      categories,
      totalWords: (words as any[]).length,
    });
  } catch (error) {
    console.error('Wordle GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── POST — add / remove word ─────────────────────────────── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await dbConnect();

    const body = await request.json();
    const { action } = body;

    /* ── addWord ─────────────────────────────────────────────── */
    if (action === 'addWord') {
      const { word } = body;
      if (!word || typeof word !== 'string') {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.wordleWordRequired }, { status: 400 });
      }

      const normalized = word.trim().toLowerCase();

      if (!POLISH_REGEX.test(normalized)) {
        return NextResponse.json(
          { error: (await getApiMessages()).t.errors.wordleOnlyPolish },
          { status: 400 },
        );
      }

      const len = normalized.length;
      if (len < MIN_LEN || len > MAX_LEN) {
        return NextResponse.json(
          { error: (await getApiMessages()).t.errors.wordleLength(MIN_LEN, MAX_LEN) },
          { status: 400 },
        );
      }

      const existing = await WordleWord.findOne({ word: normalized });
      if (existing) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.wordleWordExists }, { status: 409 });
      }

      await WordleWord.create({ word: normalized, length: len });
      return NextResponse.json({ success: true });
    }

    /* ── removeWord ──────────────────────────────────────────── */
    if (action === 'removeWord') {
      const { word } = body;
      if (!word || typeof word !== 'string') {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.wordleWordRequired }, { status: 400 });
      }

      const normalized = word.trim().toLowerCase();
      const result = await WordleWord.deleteOne({ word: normalized });

      if (result.deletedCount === 0) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.wordleWordNotFound }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: (await getApiMessages()).t.errors.unknownAction }, { status: 400 });
  } catch (error) {
    console.error('Wordle POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
