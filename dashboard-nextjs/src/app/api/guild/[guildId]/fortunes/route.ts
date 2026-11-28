import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import { requireBotOwner } from '@/lib/requireBotOwner';
import dbConnect from '@/lib/mongodb';
import Fortune from '@/models/Fortune';
import { getApiMessages } from '@/i18n/apiServer';
import { parseJsonBody } from '@/lib/apiValidation';
import { FORTUNE_MAX, FORTUNE_MIN, normalizeFortune } from '@/lib/fortunes';
import type { Session } from 'next-auth';

interface FortuneDoc {
  _id: mongoose.Types.ObjectId;
  content: string;
}

/** Wspólne dla GET i POST: zalogowany, dostęp do serwera i właściciel bota (pula wróżb jest wspólna dla bota). */
async function guard(params: Promise<{ guildId: string }>): Promise<{ session: Session } | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { guildId } = await params;
  const accessError = await requireGuildAccess(session, guildId);
  if (accessError) return accessError;
  const ownerError = requireBotOwner(session);
  if (ownerError) return ownerError;
  return { session };
}

/* ── GET - cała pula wróżb ─────────────────────────────────── */
export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const guarded = await guard(params);
    if (guarded instanceof NextResponse) return guarded;

    await dbConnect();
    const docs = await Fortune.find({}, { content: 1 }).sort({ _id: -1 }).lean<FortuneDoc[]>();
    return NextResponse.json({
      fortunes: docs.map((d) => ({ id: String(d._id), content: d.content })),
      total: docs.length,
    });
  } catch (error) {
    console.error('Fortunes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── POST - dodanie / usunięcie wróżby ─────────────────────── */
const fortunesBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), content: z.string().max(2000) }),
  z.object({ action: z.literal('remove'), id: z.string().regex(/^[a-f0-9]{24}$/i) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const guarded = await guard(params);
    if (guarded instanceof NextResponse) return guarded;
    const { session } = guarded;

    const parsed = await parseJsonBody(request, fortunesBody);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const t = (await getApiMessages()).t.errors;

    await dbConnect();

    if (body.action === 'add') {
      const content = normalizeFortune(body.content);
      if (content.length < FORTUNE_MIN || content.length > FORTUNE_MAX) {
        return NextResponse.json({ error: t.fortuneLength(FORTUNE_MIN, FORTUNE_MAX) }, { status: 400 });
      }
      const exists = await Fortune.exists({ content });
      if (exists) return NextResponse.json({ error: t.fortuneExists }, { status: 409 });

      const created = await Fortune.create({ content, addedBy: session.user?.id });
      return NextResponse.json({ success: true, fortune: { id: String(created._id), content } });
    }

    const result = await Fortune.deleteOne({ _id: new mongoose.Types.ObjectId(body.id) });
    if (result.deletedCount === 0) return NextResponse.json({ error: t.fortuneNotFound }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Fortunes POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
