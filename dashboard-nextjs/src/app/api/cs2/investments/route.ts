import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import dbConnect from '@/lib/mongodb';
import CS2Investment from '@/models/CS2Investment';

// Allowed user IDs
const ALLOWED_USER_IDS = ['548177225661546496'];

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { authorized: false, error: 'Nie zalogowany', userId: null };
  }
  
  const userId = (session.user as any)?.id;
  if (!ALLOWED_USER_IDS.includes(userId)) {
    return { authorized: false, error: 'Brak dostępu', userId };
  }
  
  return { authorized: true, error: null, userId };
}

// GET - Pobierz wszystkie inwestycje
export async function GET() {
  try {
    const auth = await checkAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    await dbConnect();
    const investments = await CS2Investment.find({ userId: auth.userId }).sort({ addedAt: -1 });
    
    return NextResponse.json({ success: true, items: investments });
  } catch (error) {
    console.error('[CS2 Investments API] GET Error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// POST - Dodaj nową inwestycję
export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { name, buyPrice, quantity, currentPrice, imageUrl } = body;

    if (!name || buyPrice === undefined || !quantity) {
      return NextResponse.json({ error: 'Brakujące pola' }, { status: 400 });
    }

    await dbConnect();
    
    const investment = await CS2Investment.create({
      userId: auth.userId,
      name,
      buyPrice,
      quantity,
      currentPrice: currentPrice || buyPrice,
      imageUrl,
      priceHistory: [{ date: new Date(), price: currentPrice || buyPrice }],
    });

    return NextResponse.json({ success: true, item: investment });
  } catch (error) {
    console.error('[CS2 Investments API] POST Error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// PUT - Aktualizuj inwestycję
export async function PUT(request: NextRequest) {
  try {
    const auth = await checkAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { id, buyPrice, quantity, currentPrice, imageUrl, addPriceHistory } = body;

    if (!id) {
      return NextResponse.json({ error: 'Brak ID' }, { status: 400 });
    }

    await dbConnect();
    
    const updateData: any = {};
    if (buyPrice !== undefined) updateData.buyPrice = buyPrice;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (currentPrice !== undefined) updateData.currentPrice = currentPrice;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    
    // Add to price history if requested
    if (addPriceHistory && currentPrice !== undefined) {
      const investment = await CS2Investment.findOne({ _id: id, userId: auth.userId });
      if (investment) {
        investment.priceHistory.push({ date: new Date(), price: currentPrice });
        // Keep only last 30 entries
        if (investment.priceHistory.length > 30) {
          investment.priceHistory = investment.priceHistory.slice(-30);
        }
        investment.currentPrice = currentPrice;
        await investment.save();
        return NextResponse.json({ success: true, item: investment });
      }
    }
    
    const investment = await CS2Investment.findOneAndUpdate(
      { _id: id, userId: auth.userId },
      updateData,
      { new: true }
    );

    if (!investment) {
      return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: investment });
  } catch (error) {
    console.error('[CS2 Investments API] PUT Error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// DELETE - Usuń inwestycję
export async function DELETE(request: NextRequest) {
  try {
    const auth = await checkAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Brak ID' }, { status: 400 });
    }

    await dbConnect();
    
    const result = await CS2Investment.findOneAndDelete({ _id: id, userId: auth.userId });

    if (!result) {
      return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CS2 Investments API] DELETE Error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
