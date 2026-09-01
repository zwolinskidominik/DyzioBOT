import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";

const usedQuestionSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    questionId: { type: String, required: true },
    usedAt: { type: Date, default: () => new Date() },
  },
  { collection: "usedquestions" }
);

const questionSchema = new mongoose.Schema(
  {
    questionId: { type: String },
    content: { type: String },
    reactions: { type: [String], default: [] },
  },
  { collection: "questions" }
);

if (mongoose.models.QOTDUsedQuestion) {
  delete mongoose.models.QOTDUsedQuestion;
}
if (mongoose.models.QOTDTodayQuestion) {
  delete mongoose.models.QOTDTodayQuestion;
}

const UsedQuestion = mongoose.model("QOTDUsedQuestion", usedQuestionSchema);
const Question = mongoose.model("QOTDTodayQuestion", questionSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

/**
 * Zwraca ostatnio wysłane pytanie dnia dla TEGO serwera (na podstawie
 * historii w kolekcji usedquestions, zapisywanej przez questionScheduler
 * przy każdym wysłaniu). Pula pytań jest globalna dla całego bota, więc bez
 * tej per-guildowej historii nie da się wiarygodnie ustalić, które pytanie
 * trafiło akurat na ten serwer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const lastUsed = await UsedQuestion.findOne({ guildId: String(guildId) })
      .sort({ usedAt: -1 })
      .lean<{ questionId: string; usedAt: Date }>();

    if (!lastUsed) {
      return NextResponse.json(null);
    }

    const question = await Question.findOne({ questionId: lastUsed.questionId }).lean<{
      questionId: string;
      content: string;
      reactions: string[];
    }>();

    if (!question) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      questionId: question.questionId,
      content: question.content,
      reactions: question.reactions ?? [],
      usedAt: lastUsed.usedAt,
    });
  } catch (error) {
    console.error("Error fetching today's QOTD question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
