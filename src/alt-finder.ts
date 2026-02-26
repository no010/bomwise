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
 * Alternative Parts Finder Module
 *
 * Searches LCSC (立创商城) for functionally equivalent replacement parts
 * for each BOM item, sorted by stock availability and price.
 */

import type { ParsedBOMItem } from './bom-analyzer.js';

/** An alternative part candidate */
export interface AlternativePart {
  /** LCSC part number */
  lcscPart: string;
  /** Part description */
  description: string;
  /** Manufacturer */
  manufacturer: string;
  /** Manufacturer part number */
  mfgPartNumber: string;
  /** Current stock quantity */
  stockQty: number;
  /** Unit price (at 1 piece) */
  unitPrice: number;
  /** Datasheet URL if available */
  datasheetUrl?: string;
  /** Part URL on LCSC */
  url: string;
  /** Similarity score 0-100 (higher = better match) */
  similarityScore: number;
}

/** Result of finding alternatives for a single BOM item */
export interface AlternativeResult {
  /** The original BOM item */
  original: ParsedBOMItem;
  /** Alternative parts found, sorted by similarity score descending */
  alternatives: AlternativePart[];
  /** Whether a suitable alternative was found */
  found: boolean;
}

/** LCSC API base URL */
const LCSC_API_BASE = 'https://pro.lceda.cn/api/eda/product';

/**
 * Find alternative parts for a single BOM item.
 * Searches by value and description keywords to find compatible replacements.
 *
 * @param item - The BOM item to find alternatives for
 * @param maxResults - Maximum number of alternatives to return (default: 5)
 */
export async function findAlternativesForItem(
  item: ParsedBOMItem,
  maxResults = 5
): Promise<AlternativeResult> {
  const searchQuery = buildSearchQuery(item);

  // Skip items with no meaningful search query
  if (!searchQuery) {
    return { original: item, alternatives: [], found: false };
  }

  try {
    const url = `${LCSC_API_BASE}/search?keyword=${encodeURIComponent(searchQuery)}&currentPage=1&pageSize=20`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { original: item, alternatives: [], found: false };
    }

    const data = (await response.json()) as LCSCSearchResponse;
    if (!data.success || !data.result?.list?.length) {
      return { original: item, alternatives: [], found: false };
    }

    const alternatives = data.result.list
      .filter((part) => part.productCode !== item.lcscPart) // exclude the original
      .map((part) => mapToAlternative(part, item))
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, maxResults);

    return {
      original: item,
      alternatives,
      found: alternatives.length > 0,
    };
  } catch {
    return { original: item, alternatives: [], found: false };
  }
}

/**
 * Find alternatives for all BOM items that have LCSC part numbers.
 * Processes items in batches to avoid overwhelming the API.
 *
 * @param items - All BOM items
 * @param maxResultsPerItem - Max alternatives per item (default: 5)
 */
export async function findAllAlternatives(
  items: ParsedBOMItem[],
  maxResultsPerItem = 5
): Promise<AlternativeResult[]> {
  const BATCH_SIZE = 3;
  const results: AlternativeResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((item) => findAlternativesForItem(item, maxResultsPerItem))
    );
    results.push(...batchResults);
  }

  return results;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Build a search query string from the BOM item's attributes.
 * Priority: description > value > lcscPart. Returns empty string if nothing available.
 *
 * @internal exported for unit testing
 */
export function buildSearchQuery(item: ParsedBOMItem): string {
  // Use description if meaningful (longer than 3 chars and not just a value)
  if (item.description && item.description.length > 3) {
    return item.description;
  }
  // Fall back to value
  if (item.value) {
    return item.value;
  }
  // Last resort: use the LCSC part number itself (may still be empty)
  return item.lcscPart;
}

/**
 * Calculate a rough similarity score between a candidate part and the
 * original BOM item based on description keyword overlap.
 */
function calcSimilarityScore(
  candidate: LCSCPartResult,
  original: ParsedBOMItem
): number {
  let score = 0;

  const candidateDesc = (
    (candidate.description ?? '') +
    ' ' +
    (candidate.title ?? '')
  ).toLowerCase();

  const originalDesc = (
    original.description +
    ' ' +
    original.value +
    ' ' +
    original.mfgPartNumber
  ).toLowerCase();

  // Keyword overlap scoring
  const originalWords = originalDesc
    .split(/[\s,\-/]+/)
    .filter((w) => w.length > 1);
  for (const word of originalWords) {
    if (candidateDesc.includes(word)) {
      score += 10;
    }
  }

  // Prefer parts with stock
  if ((candidate.stockCount ?? 0) > 0) score += 20;

  // Prefer parts with price info
  if (candidate.prices && candidate.prices.length > 0) score += 10;

  return Math.min(score, 100);
}

function mapToAlternative(
  part: LCSCPartResult,
  original: ParsedBOMItem
): AlternativePart {
  const unitPrice =
    part.prices && part.prices.length > 0
      ? parseFloat(String(part.prices[0].productPrice ?? 0))
      : 0;

  return {
    lcscPart: part.productCode ?? '',
    description: part.description ?? part.title ?? '',
    manufacturer: part.brandNameEn ?? part.brandName ?? '',
    mfgPartNumber: part.productModel ?? '',
    stockQty: part.stockCount ?? 0,
    unitPrice,
    datasheetUrl: part.pdfUrl ?? undefined,
    url: `https://item.szlcsc.com/${part.productId}.html`,
    similarityScore: calcSimilarityScore(part, original),
  };
}

// ─── LCSC API response types ───────────────────────────────────────────────────

interface LCSCPriceEntry {
  productPrice?: number | string;
}

interface LCSCPartResult {
  productCode?: string;
  productId?: string | number;
  title?: string;
  description?: string;
  productModel?: string;
  brandName?: string;
  brandNameEn?: string;
  stockCount?: number;
  pdfUrl?: string;
  prices?: LCSCPriceEntry[];
}

interface LCSCSearchResponse {
  success: boolean;
  result?: {
    list?: LCSCPartResult[];
  };
}
