export interface CS2Item {
  id: string;
  name: string;
  buyPrice: number;
  quantity: number;
  currentPrice: number;
  addedAt: string;
  priceHistory?: PricePoint[];
  imageUrl?: string;
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface CS2PriceResponse {
  success: boolean;
  price: number;
  priceUSD?: number;
  volume?: string;
  itemName: string;
}

export interface CS2Statistics {
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  profitPercentage: number;
}
