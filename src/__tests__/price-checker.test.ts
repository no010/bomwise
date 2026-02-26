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

import { getBestPrice, parsePriceTiers } from '../price-checker.js';
import type { PriceTier } from '../price-checker.js';

// ─── parsePriceTiers ───────────────────────────────────────────────────────────

describe('parsePriceTiers', () => {
  it('returns an empty array for empty input', () => {
    expect(parsePriceTiers([])).toEqual([]);
  });

  it('parses numeric productPrice', () => {
    const result = parsePriceTiers([{ startNumber: 1, productPrice: 1.5 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ minQty: 1, unitPrice: 1.5 });
  });

  it('parses string productPrice', () => {
    const result = parsePriceTiers([{ startNumber: 10, productPrice: '0.85' }]);
    expect(result[0].unitPrice).toBe(0.85);
  });

  it('defaults startNumber to 1 when absent', () => {
    const result = parsePriceTiers([{ productPrice: 2.0 }]);
    expect(result[0].minQty).toBe(1);
  });

  it('sorts tiers by minQty ascending', () => {
    const raw = [
      { startNumber: 100, productPrice: 0.5 },
      { startNumber: 1, productPrice: 2.0 },
      { startNumber: 10, productPrice: 1.0 },
    ];
    const result = parsePriceTiers(raw);
    expect(result.map((t) => t.minQty)).toEqual([1, 10, 100]);
  });

  it('handles zero productPrice', () => {
    const result = parsePriceTiers([{ startNumber: 1, productPrice: 0 }]);
    expect(result[0].unitPrice).toBe(0);
  });
});

// ─── getBestPrice ─────────────────────────────────────────────────────────────

describe('getBestPrice', () => {
  it('returns 0 when no tiers are available', () => {
    expect(getBestPrice([], 5)).toBe(0);
  });

  it('returns the only tier price regardless of quantity', () => {
    const tiers: PriceTier[] = [{ minQty: 1, unitPrice: 3.0 }];
    expect(getBestPrice(tiers, 1)).toBe(3.0);
    expect(getBestPrice(tiers, 100)).toBe(3.0);
  });

  it('applies the best (lowest) price for the given quantity', () => {
    const tiers: PriceTier[] = [
      { minQty: 1, unitPrice: 2.0 },
      { minQty: 10, unitPrice: 1.5 },
      { minQty: 100, unitPrice: 1.0 },
    ];
    expect(getBestPrice(tiers, 1)).toBe(2.0);
    expect(getBestPrice(tiers, 10)).toBe(1.5);
    expect(getBestPrice(tiers, 50)).toBe(1.5);
    expect(getBestPrice(tiers, 100)).toBe(1.0);
    expect(getBestPrice(tiers, 999)).toBe(1.0);
  });

  it('uses the first tier when quantity is below all minimums', () => {
    const tiers: PriceTier[] = [
      { minQty: 10, unitPrice: 1.5 },
      { minQty: 100, unitPrice: 1.0 },
    ];
    // quantity 5 is below the first tier minimum of 10, so returns first tier
    expect(getBestPrice(tiers, 5)).toBe(1.5);
  });
});
