import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";
import MonthlyStatsModel from "@/models/MonthlyStats";
import { getMonthString, monthFooterLabel, monthFullLabel, monthAbbr, RawMonth } from "@/lib/monthlyStats";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const TREND_MONTHS = 6;

/**
 * Surowe per-user statystyki (wiadomości/voice) za ostatnie 6 miesięcy (włącznie
 * z bieżącym, w trakcie) — bezpośrednio z read-only kolekcji `monthlystats`, bez
 * wywoływania procesu bota. Wynik (score) liczony jest KLIENCKO z aktualnych
 * suwaków msgRate/voiceRate/topSize, żeby wykres i podgląd reagowały na żywo.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const now = new Date();
    const monthIds = Array.from({ length: TREND_MONTHS }, (_, i) => getMonthString(now, TREND_MONTHS - 1 - i));
    const currentMonthId = getMonthString(now, 0);

    const [docs, guildInfo] = await Promise.all([
      // mongoose.trusted(): sanitizeFilter (instrumentation.ts) sanityzuje KAŻDY
      // operator $in/$nin niezależnie od tego czy tablica jest pusta — bez tego
      // ta cała trasa 500-uje zawsze, nie tylko dla pustej tablicy.
      MonthlyStatsModel.find({ guildId, month: mongoose.trusted({ $in: monthIds }) })
        .select({ userId: 1, month: 1, messageCount: 1, voiceMinutes: 1, _id: 0 })
        .lean(),
      fetchGuildInfo(guildId),
    ]);

    const months: RawMonth[] = monthIds.map((id) => {
      const [, mm] = id.split("-");
      return {
        id,
        abbr: monthAbbr(mm),
        full: monthFullLabel(id),
        footerLabel: monthFooterLabel(id),
        isCurrent: id === currentMonthId,
        users: docs
          .filter((d) => d.month === id)
          .map((d) => ({ userId: d.userId, messageCount: d.messageCount, voiceMinutes: d.voiceMinutes })),
      };
    });

    return NextResponse.json({ months, guildName: guildInfo.name, guildIconURL: guildInfo.iconURL });
  } catch (error) {
    console.error("Error fetching monthly stats raw data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function fetchGuildInfo(guildId: string): Promise<{ name: string; iconURL: string | null }> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    });
    if (!res.ok) return { name: "Serwer", iconURL: null };
    const guild = (await res.json()) as { name: string; icon: string | null };
    return {
      name: guild.name,
      iconURL: guild.icon ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png?size=128` : null,
    };
  } catch {
    return { name: "Serwer", iconURL: null };
  }
}
