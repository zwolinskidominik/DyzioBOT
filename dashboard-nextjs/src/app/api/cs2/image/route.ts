import { NextRequest, NextResponse } from 'next/server';

// Cache for ByMykel CSGO-API data
interface CS2ItemData {
  name: string;
  market_hash_name?: string;
  image: string;
}

let itemsCache: CS2ItemData[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ByMykel API endpoints
const API_URLS = [
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/collections.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/agents.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/patches.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/graffiti.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/keys.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/music_kits.json',
];

async function loadItemsCache(): Promise<CS2ItemData[]> {
  // Check if cache is still valid
  if (itemsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return itemsCache;
  }

  console.log('[CS2 Image] Loading items from ByMykel CSGO-API...');
  
  const allItems: CS2ItemData[] = [];
  
  for (const url of API_URLS) {
    try {
      const response = await fetch(url, {
        next: { revalidate: 86400 } // Cache for 24 hours
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle different data structures
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.image) {
              allItems.push({
                name: item.name || '',
                market_hash_name: item.market_hash_name || item.name || '',
                image: item.image,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`[CS2 Image] Error loading ${url}:`, error);
    }
  }
  
  console.log(`[CS2 Image] Loaded ${allItems.length} items into cache`);
  
  itemsCache = allItems;
  cacheTimestamp = Date.now();
  
  return allItems;
}

function findBestMatch(items: CS2ItemData[], searchName: string): CS2ItemData | null {
  const normalizedSearch = searchName.toLowerCase().trim();
  
  // First try exact match on market_hash_name
  let match = items.find(item => 
    item.market_hash_name?.toLowerCase() === normalizedSearch
  );
  
  if (match) return match;
  
  // Try exact match on name
  match = items.find(item => 
    item.name.toLowerCase() === normalizedSearch
  );
  
  if (match) return match;
  
  // Try partial match (contains)
  match = items.find(item => 
    item.market_hash_name?.toLowerCase().includes(normalizedSearch) ||
    item.name.toLowerCase().includes(normalizedSearch)
  );
  
  if (match) return match;
  
  // Try reverse partial match (search contains item name)
  match = items.find(item => 
    normalizedSearch.includes(item.name.toLowerCase())
  );
  
  return match || null;
}

// API to get item image
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

    // Load cache if needed
    const items = await loadItemsCache();
    
    // Find the item
    const item = findBestMatch(items, itemName);
    
    if (item && item.image) {
      console.log(`[CS2 Image] Found: ${itemName} -> ${item.name}`);
      
      return NextResponse.json({
        success: true,
        imageUrl: item.image,
        itemName: item.name,
        matchedName: item.market_hash_name || item.name,
      });
    }
    
    console.log(`[CS2 Image] Not found: ${itemName}`);
    
    return NextResponse.json({
      success: false,
      imageUrl: null,
      itemName,
    });

  } catch (error) {
    console.error('[CS2 Image] Error:', error);
    return NextResponse.json(
      { 
        error: 'Błąd serwera',
        imageUrl: null,
        success: false,
      },
      { status: 500 }
    );
  }
}
