import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import dbConnect from "@/lib/mongodb";
import HangmanCategory from "@/models/HangmanCategory";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params;
    await dbConnect();

    const categories = await HangmanCategory.find().lean();

    const summary = categories.map((c: any) => ({
      name: c.name,
      emoji: c.emoji,
      wordCount: c.words.length,
      words: c.words,
    }));

    return NextResponse.json({
      categories: summary,
      totalWords: summary.reduce((sum: number, c: any) => sum + c.wordCount, 0),
      totalCategories: summary.length,
    });
  } catch (error) {
    console.error("Error fetching hangman data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params;
    await dbConnect();

    const body = await request.json();
    const { action } = body;

    if (action === "addWord") {
      const { categoryName, word } = body;
      if (!categoryName || !word) {
        return NextResponse.json({ error: "Wymagane: categoryName, word" }, { status: 400 });
      }

      const normalized = word.toLowerCase().trim();
      if (!/^[a-ząćęłńóśźż]+$/.test(normalized)) {
        return NextResponse.json(
          { error: "Słowo może zawierać tylko polskie litery (bez q, v, x)" },
          { status: 400 }
        );
      }

      const cat = await HangmanCategory.findOne({ name: categoryName });
      if (!cat) {
        return NextResponse.json({ error: "Nie znaleziono kategorii" }, { status: 404 });
      }

      if (cat.words.includes(normalized)) {
        return NextResponse.json({ error: "Słowo już istnieje w tej kategorii" }, { status: 409 });
      }

      cat.words.push(normalized);
      await cat.save();

      return NextResponse.json({ success: true, wordCount: cat.words.length });
    }

    if (action === "removeWord") {
      const { categoryName, word } = body;
      if (!categoryName || !word) {
        return NextResponse.json({ error: "Wymagane: categoryName, word" }, { status: 400 });
      }

      const cat = await HangmanCategory.findOne({ name: categoryName });
      if (!cat) {
        return NextResponse.json({ error: "Nie znaleziono kategorii" }, { status: 404 });
      }

      const idx = cat.words.indexOf(word);
      if (idx === -1) {
        return NextResponse.json({ error: "Nie znaleziono słowa w kategorii" }, { status: 404 });
      }

      cat.words.splice(idx, 1);
      await cat.save();

      return NextResponse.json({ success: true, wordCount: cat.words.length });
    }

    if (action === "addCategory") {
      const { name, emoji } = body;
      if (!name || !emoji) {
        return NextResponse.json({ error: "Wymagane: name, emoji" }, { status: 400 });
      }

      const existing = await HangmanCategory.findOne({ name });
      if (existing) {
        return NextResponse.json({ error: "Kategoria o tej nazwie już istnieje" }, { status: 409 });
      }

      const cat = await HangmanCategory.create({ name, emoji, words: [] });
      return NextResponse.json({ success: true, category: cat.toObject() });
    }

    if (action === "removeCategory") {
      const { categoryName } = body;
      if (!categoryName) {
        return NextResponse.json({ error: "Wymagane: categoryName" }, { status: 400 });
      }

      const result = await HangmanCategory.deleteOne({ name: categoryName });
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: "Nie znaleziono kategorii" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    console.error("Error in hangman POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
