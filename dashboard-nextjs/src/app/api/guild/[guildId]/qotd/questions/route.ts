import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { getBotEmojiIds, findInvalidCustomEmojis } from '@/lib/botEmojis';

async function validateReactions(reactions: unknown): Promise<string | null> {
  if (reactions === undefined) return null;
  if (!Array.isArray(reactions) || !reactions.every((r) => typeof r === 'string')) {
    return 'Reactions musi być tablicą stringów';
  }
  const botEmojiIds = await getBotEmojiIds();
  const invalid = findInvalidCustomEmojis(reactions, botEmojiIds);
  if (invalid.length > 0) {
    return 'Można używać tylko standardowych emoji lub emoji bota';
  }
  return null;
}

const questionSchema = new mongoose.Schema({
  questionId: { type: String, default: () => randomUUID() },
  authorId: { type: String, required: true },
  content: { type: String, required: true, unique: true },
  reactions: { type: [String], default: [] },
  disabled: { type: Boolean, default: false },
  usedAt: { type: Date },
}, {
  collection: 'questions'
});

// Pula pytań (Question) jest globalna dla całego bota — dodawana przez
// właściciela dla wszystkich serwerów. Każdy serwer śledzi jednak swoje
// własne użycie przez UsedQuestion (guildId + questionId), więc pytania nie
// powtarzają się na tym samym serwerze, dopóki nie przejdzie całej puli.
const usedQuestionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  questionId: { type: String, required: true },
  usedAt: { type: Date, default: () => new Date() },
}, {
  collection: 'usedquestions'
});

if (mongoose.models.Question) {
  delete mongoose.models.Question;
}
if (mongoose.models.QOTDQuestionsUsedQuestion) {
  delete mongoose.models.QOTDQuestionsUsedQuestion;
}

const Question = mongoose.model('Question', questionSchema);
const UsedQuestion = mongoose.model('QOTDQuestionsUsedQuestion', usedQuestionSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const showDisabled = searchParams.get('disabled') === 'true';

    // Pula (Question, disabled=true) jest globalnie wyłączona przez właściciela —
    // to jest niezależne od tego, które pytania dany serwer już wykorzystał.
    const usedForGuild = await UsedQuestion.find({ guildId })
      .sort({ usedAt: -1 })
      .lean<{ questionId: string; usedAt: Date }[]>();
    const usedIds = usedForGuild.map((u) => u.questionId);

    if (showDisabled) {
      // "Użyte" — pytania z globalnej puli, które TEN serwer już wysłał.
      // mongoose.trusted(): sanitizeFilter (włączone globalnie w instrumentation.ts)
      // sanityzuje KAŻDY zagnieżdżony obiekt osobno (rekurencyjnie) — oznaczenie
      // jako trusted tylko na zewnętrznym obiekcie filtra NIE propaguje się w dół
      // do { $in: usedIds }, trzeba oznaczyć dokładnie ten wewnętrzny obiekt.
      // usedIds pochodzi z własnego query do UsedQuestion, nie z inputu usera, więc
      // oznaczenie jako trusted jest tu bezpieczne.
      const questions = await Question.find({ questionId: mongoose.trusted({ $in: usedIds }) }).lean();
      const usedAtByQuestionId = new Map(usedForGuild.map((u) => [u.questionId, u.usedAt]));
      const ordered = questions
        .map((q) => ({ ...q, disabled: true, usedAt: usedAtByQuestionId.get(q.questionId) }))
        .sort((a, b) => (b.usedAt?.getTime() ?? 0) - (a.usedAt?.getTime() ?? 0));
      return NextResponse.json(ordered);
    }

    // "Aktywne" — globalnie włączone pytania, których TEN serwer jeszcze nie wysłał.
    // mongoose.trusted(): sanitizeFilter sanityzuje KAŻDY operator w ręcznie
    // pisanym filtrze, nie tylko $in/$nin — trzeba oznaczyć też $ne.
    const questions = await Question.find({
      disabled: mongoose.trusted({ $ne: true }),
      questionId: mongoose.trusted({ $nin: usedIds }),
    }).sort({ _id: 1 });

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const body = await request.json();
    const { content, reactions } = body;

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const reactionsError = await validateReactions(reactions);
    if (reactionsError) {
      return NextResponse.json({ error: reactionsError }, { status: 400 });
    }

    await connectDB();

    const question = new Question({
      questionId: randomUUID(),
      authorId: session.user.id,
      content: content.trim(),
      reactions: reactions || []
    });

    await question.save();

    return NextResponse.json(question.toObject());
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const body = await request.json();
    const { questionId, content, reactions, disabled } = body;

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    await connectDB();

    // Restore action: pytanie wraca do puli TYLKO dla tego serwera — usuwamy
    // jego wpis w UsedQuestion, więc inne serwery (które go jeszcze nie
    // dostały) w ogóle to nie dotyczy.
    if (disabled === false) {
      const question = await Question.findOne({ questionId }).lean();
      if (!question) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }
      await UsedQuestion.deleteOne({ guildId, questionId });
      return NextResponse.json({ ...question, disabled: false });
    }

    // Mark-as-used action: pytanie znika z "Aktywnych" TYLKO dla tego serwera —
    // zapisujemy wpis w UsedQuestion scoped do guildId z URL (nigdy z body), więc
    // inne serwery nadal widzą to pytanie jako aktywne. Upsert, żeby podwójny
    // klik / wyścig requestów nie wywalił się na unique konflikcie.
    if (disabled === true) {
      const question = await Question.findOne({ questionId }).lean();
      if (!question) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }
      await UsedQuestion.findOneAndUpdate(
        { guildId, questionId },
        { $setOnInsert: { guildId, questionId, usedAt: new Date() } },
        { upsert: true }
      );
      return NextResponse.json({ ...question, disabled: true });
    }

    // Regular update: content + reactions
    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const reactionsError = await validateReactions(reactions);
    if (reactionsError) {
      return NextResponse.json({ error: reactionsError }, { status: 400 });
    }

    const question = await Question.findOneAndUpdate(
      { questionId },
      { 
        content: content.trim(),
        reactions: reactions || []
      },
      { new: true }
    );

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(question.toObject());
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    await connectDB();
    
    const result = await Question.deleteOne({ questionId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Pytanie znika z globalnej puli — sprzątamy też historię użycia po nim
    // na wszystkich serwerach, żeby nie zostawały osierocone wpisy.
    await UsedQuestion.deleteMany({ questionId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
