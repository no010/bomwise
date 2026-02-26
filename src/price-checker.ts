// Copyright 2024 BOMWise Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Price Checker Module
 *
 * Queries real-time inventory and pricing data from the LCSC (立创商城) open
 * API for each BOM item, using the `message` EDA API to provide user feedback.
 */

import type { ParsedBOMItem } from './bom-analyzer.js';

/** Price break tier returned by the API */
export interface PriceTier {
  /** Minimum quantity for this price tier */
  minQty: number;
  /** Unit price in CNY */
  unitPrice: number;
}

/** Stock and pricing data for a single part */
export interface PartPriceInfo {
  /** LCSC part number */
  lcscPart: string;
  /** Quantity in stock */
  stockQty: number;
  /** Price break tiers */
  priceTiers: PriceTier[];
  /** Unit price for the required quantity (best matching tier) */
  effectiveUnitPrice: number;
  /** Total cost for the required quantity */
  totalCost: number;
  /** Part description from LCSC */
  description: string;
  /** Minimum order quantity */
  moq: number;
  /** Whether the part is currently available */
  available: boolean;
  /** Part URL on LCSC */
  url: string;
}

/** Result of a full BOM price check */
export interface PriceCheckResult {
  /** Per-part pricing info */
  partPrices: Map<string, PartPriceInfo>;
  /** Total estimated BOM cost */
  totalEstimatedCost: number;
  /** Parts with insufficient stock */
  outOfStockParts: string[];
  /** Parts that could not be found */
  notFoundParts: string[];
}

/** LCSC open API base URL */
const LCSC_API_BASE = 'https://pro.lceda.cn/api/eda/product';

/**
 * Fetch price and stock info for a single LCSC part number.
 *
 * @param lcscPart - LCSC part number (e.g. "C12345")
 * @param quantity - Required quantity
 */
async function fetchPartPrice(
  lcscPart: string,
  quantity: number
): Promise<PartPriceInfo | null> {
  try {
    const url = `${LCSC_API_BASE}/search?keyword=${encodeURIComponent(lcscPart)}&currentPage=1&pageSize=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as LCSCSearchResponse;

    if (!data.success || !data.result?.list?.length) {
      return null;
    }

    const part = data.result.list[0];
    const priceTiers = parsePriceTiers(part.prices ?? []);
    const effectiveUnitPrice = getBestPrice(priceTiers, quantity);

    return {
      lcscPart,
      stockQty: part.stockCount ?? 0,
      priceTiers,
      effectiveUnitPrice,
      totalCost: effectiveUnitPrice * quantity,
      description: part.description ?? part.title ?? '',
      moq: part.minBuyNumber ?? 1,
      available: (part.stockCount ?? 0) >= quantity,
      url: `https://item.szlcsc.com/${part.productId}.html`,
    };
  } catch {
    return null;
  }
}

/**
 * Check prices and inventory for all BOM items that have LCSC part numbers.
 *
 * Uses the EDA `message` API (non-system API #3) to keep the user informed
 * during the (potentially long) fetching process.
 *
 * @param items - Parsed BOM items to check
 * @returns Price check result with per-part data and totals
 */
export async function checkPrices(
  items: ParsedBOMItem[]
): Promise<PriceCheckResult> {
  const itemsWithLcsc = items.filter((item) => item.lcscPart);

  if (itemsWithLcsc.length === 0) {
    throw new Error('BOM中没有带立创商城编号的元器件，请先添加LCSC型号');
  }

  // Non-system API call #3: eda.message
  eda.message.info(`正在查询 ${itemsWithLcsc.length} 个元器件的价格与库存...`);

  const partPrices = new Map<string, PartPriceInfo>();
  const outOfStockParts: string[] = [];
  const notFoundParts: string[] = [];

  // Fetch prices concurrently in batches of 5 to avoid API rate limiting
  const BATCH_SIZE = 5;
  for (let i = 0; i < itemsWithLcsc.length; i += BATCH_SIZE) {
    const batch = itemsWithLcsc.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((item) => fetchPartPrice(item.lcscPart, item.quantity))
    );

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const priceInfo = batchResults[j];

      if (!priceInfo) {
        notFoundParts.push(item.lcscPart);
      } else {
        partPrices.set(item.lcscPart, priceInfo);
        if (!priceInfo.available) {
          outOfStockParts.push(item.lcscPart);
        }
      }
    }
  }

  const totalEstimatedCost = Array.from(partPrices.values()).reduce(
    (sum, info) => sum + info.totalCost,
    0
  );

  return {
    partPrices,
    totalEstimatedCost,
    outOfStockParts,
    notFoundParts,
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** @internal exported for unit testing */
export function parsePriceTiers(raw: LCSCPriceEntry[]): PriceTier[] {
  return raw
    .map((entry) => ({
      minQty: entry.startNumber ?? 1,
      unitPrice: parseFloat(String(entry.productPrice ?? 0)),
    }))
    .sort((a, b) => a.minQty - b.minQty);
}

/** @internal exported for unit testing */
export function getBestPrice(tiers: PriceTier[], quantity: number): number {
  if (tiers.length === 0) return 0;
  let best = tiers[0].unitPrice;
  for (const tier of tiers) {
    if (quantity >= tier.minQty) {
      best = tier.unitPrice;
    }
  }
  return best;
}

// ─── LCSC API response types ───────────────────────────────────────────────────

interface LCSCPriceEntry {
  startNumber?: number;
  productPrice?: number | string;
}

interface LCSCPartResult {
  productId?: string | number;
  title?: string;
  description?: string;
  stockCount?: number;
  minBuyNumber?: number;
  prices?: LCSCPriceEntry[];
}

interface LCSCSearchResponse {
  success: boolean;
  result?: {
    list?: LCSCPartResult[];
  };
}
