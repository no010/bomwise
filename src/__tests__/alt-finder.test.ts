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

import { buildSearchQuery, findAlternativesForItem } from '../alt-finder.js';
import type { ParsedBOMItem } from '../bom-analyzer.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ParsedBOMItem> = {}): ParsedBOMItem {
  return {
    lcscPart: '',
    designators: ['R1'],
    value: '',
    footprint: '0402',
    description: '',
    manufacturer: '',
    mfgPartNumber: '',
    quantity: 1,
    ...overrides,
  };
}

// ─── buildSearchQuery ─────────────────────────────────────────────────────────

describe('buildSearchQuery', () => {
  it('prefers description when longer than 3 characters', () => {
    const item = makeItem({ description: '100nF capacitor', value: '100nF' });
    expect(buildSearchQuery(item)).toBe('100nF capacitor');
  });

  it('falls back to value when description is too short', () => {
    const item = makeItem({ description: 'ok', value: '10k' });
    expect(buildSearchQuery(item)).toBe('10k');
  });

  it('falls back to value when description is absent', () => {
    const item = makeItem({ value: '4.7uF' });
    expect(buildSearchQuery(item)).toBe('4.7uF');
  });

  it('falls back to lcscPart when both description and value are absent', () => {
    const item = makeItem({ lcscPart: 'C12345' });
    expect(buildSearchQuery(item)).toBe('C12345');
  });

  it('returns empty string when all fields are absent', () => {
    const item = makeItem();
    expect(buildSearchQuery(item)).toBe('');
  });
});

// ─── findAlternativesForItem (empty-query guard) ──────────────────────────────

describe('findAlternativesForItem', () => {
  it('returns empty result without making a fetch when searchQuery is empty', async () => {
    const item = makeItem(); // no description, no value, no lcscPart
    const result = await findAlternativesForItem(item);
    expect(result.found).toBe(false);
    expect(result.alternatives).toHaveLength(0);
  });

  it('returns empty result when fetch fails', async () => {
    // Temporarily override globalThis.fetch to simulate network failure
    const originalFetch = global.fetch;
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const item = makeItem({ value: '10k' });
    const result = await findAlternativesForItem(item);
    expect(result.found).toBe(false);
    (global as unknown as { fetch: unknown }).fetch = originalFetch;
  });

  it('returns empty result when API returns non-ok response', async () => {
    const originalFetch = global.fetch;
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    const item = makeItem({ value: '10k' });
    const result = await findAlternativesForItem(item);
    expect(result.found).toBe(false);
    (global as unknown as { fetch: unknown }).fetch = originalFetch;
  });

  it('excludes the original LCSC part from alternatives', async () => {
    const originalFetch = global.fetch;
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          list: [
            { productCode: 'C99999', productId: '1', title: '10k Resistor', stockCount: 100, prices: [] },
            { productCode: 'C11111', productId: '2', title: '10k Alt', stockCount: 50, prices: [] },
          ],
        },
      }),
    });
    const item = makeItem({ lcscPart: 'C99999', value: '10k', description: '10k Resistor' });
    const result = await findAlternativesForItem(item);
    expect(result.alternatives.every((a) => a.lcscPart !== 'C99999')).toBe(true);
    (global as unknown as { fetch: unknown }).fetch = originalFetch;
  });
});
