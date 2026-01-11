import { NextRequest, NextResponse } from 'next/server';

// Steam Market API endpoint
const STEAM_MARKET_API = 'https://steamcommunity.com/market/priceoverview/';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemName = searchParams.get('itemName');

    if (!itemName) {
      return NextResponse.json(
        { error: 'Brak nazwy przedmiotu' },
        { status: 400 }
      );
    }

    // CS2 App ID and currency PLN
    const appId = 730;
    const currency = 6; // PLN

    const url = `${STEAM_MARKET_API}?appid=${appId}&currency=${currency}&market_hash_name=${encodeURIComponent(itemName)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: {
        revalidate: 300, // Cache for 5 minutes
      },
    });

    if (!response.ok) {
      throw new Error('Błąd podczas pobierania danych z Steam API');
    }

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: 'Nie znaleziono przedmiotu', price: 0 },
        { status: 404 }
      );
    }

    // Parse price from string like "1,23 zł" to number
    const lowestPrice = data.lowest_price?.replace('zł', '').replace(',', '.').trim() || '0';
    const medianPrice = data.median_price?.replace('zł', '').replace(',', '.').trim() || '0';
    
    const price = parseFloat(lowestPrice) || parseFloat(medianPrice) || 0;

    return NextResponse.json({
      success: true,
      price,
      volume: data.volume || '0',
      lowest_price: data.lowest_price,
      median_price: data.median_price,
      itemName,
    });

  } catch (error) {
    console.error('CS2 Price API Error:', error);
    return NextResponse.json(
      { 
        error: 'Błąd serwera',
        price: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
