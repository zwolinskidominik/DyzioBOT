import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import dbConnect from "@/lib/mongodb";
import HangmanCategory from "@/models/HangmanCategory";
import { getApiMessages } from "@/i18n/apiServer";

export async function GET(
  request: Request,
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

    await dbConnect();

    const categories = await HangmanCategory.find().sort({ order: 1, _id: 1 }).lean();

    const summary = categories.map((c: any) => ({
      name: c.name,
      emoji: c.emoji,
      wordCount: c.words.length,
      words: [...c.words].sort((a: string, b: string) => a.localeCompare(b, 'pl')),
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

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await dbConnect();

    const body = await request.json();
    const { action } = body;

    if (action === "addWord") {
      const { categoryName, word } = body;
      if (!categoryName || !word) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanWordAndCategoryRequired }, { status: 400 });
      }

      const normalized = word.toLowerCase().trim();
      if (!/^[a-ząćęłńóśźż]+(\s[a-ząćęłńóśźż]+){0,3}$/.test(normalized)) {
        return NextResponse.json(
          { error: (await getApiMessages()).t.errors.hangmanOnlyPolish },
          { status: 400 }
        );
      }

      const cat = await HangmanCategory.findOne({ name: categoryName });
      if (!cat) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanCategoryNotFound }, { status: 404 });
      }

      if (cat.words.includes(normalized)) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanWordExists }, { status: 409 });
      }

      cat.words.push(normalized);
      await cat.save();

      return NextResponse.json({ success: true, wordCount: cat.words.length });
    }

    if (action === "removeWord") {
      const { categoryName, word } = body;
      if (!categoryName || !word) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanWordAndCategoryRequired }, { status: 400 });
      }

      const cat = await HangmanCategory.findOne({ name: categoryName });
      if (!cat) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanCategoryNotFound }, { status: 404 });
      }

      const idx = cat.words.indexOf(word);
      if (idx === -1) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanWordNotFound }, { status: 404 });
      }

      cat.words.splice(idx, 1);
      await cat.save();

      return NextResponse.json({ success: true, wordCount: cat.words.length });
    }

    if (action === "addCategory") {
      const { name, emoji } = body;
      if (!name || !emoji) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanNameAndEmojiRequired }, { status: 400 });
      }

      const existing = await HangmanCategory.findOne({ name });
      if (existing) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanCategoryExists }, { status: 409 });
      }

      // Nowa kategoria trafia na koniec listy, nie na początek (order domyślnie 0 zepchnąłby ją przed inne).
      const count = await HangmanCategory.countDocuments();
      const cat = await HangmanCategory.create({ name, emoji, words: [], order: count });
      return NextResponse.json({ success: true, category: cat.toObject() });
    }

    if (action === "editCategory") {
      const { categoryName, newName, newEmoji } = body;
      if (!categoryName || !newName || !newEmoji) {
        return NextResponse.json(
          { error: (await getApiMessages()).t.errors.hangmanRenameRequired },
          { status: 400 }
        );
      }

      const trimmedName = String(newName).trim();
      const trimmedEmoji = String(newEmoji).trim();
      if (!trimmedName || !trimmedEmoji) {
        return NextResponse.json(
          { error: (await getApiMessages()).t.errors.hangmanNameAndEmojiEmpty },
          { status: 400 }
        );
      }

      const cat = await HangmanCategory.findOne({ name: categoryName });
      if (!cat) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanCategoryNotFound }, { status: 404 });
      }

      if (trimmedName !== categoryName) {
        const conflict = await HangmanCategory.findOne({ name: trimmedName });
        if (conflict) {
          return NextResponse.json(
            { error: (await getApiMessages()).t.errors.hangmanCategoryExists },
            { status: 409 }
          );
        }
      }

      cat.name = trimmedName;
      cat.emoji = trimmedEmoji;
      await cat.save();

      return NextResponse.json({ success: true, category: cat.toObject() });
    }

    if (action === "reorderCategories") {
      const { names } = body;
      if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanNamesRequired }, { status: 400 });
      }

      // Explicit whitelist — jedyne pole, które ta akcja modyfikuje, to `order`, po nazwie
      // z listy przysłanej przez klienta (bez mass assignment reszty dokumentu).
      await Promise.all(
        names.map((name: string, index: number) => HangmanCategory.updateOne({ name }, { order: index }))
      );

      return NextResponse.json({ success: true });
    }

    if (action === "removeCategory") {
      const { categoryName } = body;
      if (!categoryName) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanCategoryRequired }, { status: 400 });
      }

      const result = await HangmanCategory.deleteOne({ name: categoryName });
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: (await getApiMessages()).t.errors.hangmanCategoryNotFound }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: (await getApiMessages()).t.errors.unknownAction }, { status: 400 });
  } catch (error) {
    console.error("Error in hangman POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
