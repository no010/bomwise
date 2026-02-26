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

import { parseBOMItems, analyzeBOM } from '../bom-analyzer.js';
import type { BOMItem } from '../eda-api.js';

// ─── Mock the global `eda` object ─────────────────────────────────────────────

const mockEda = {
  getBOM: jest.fn<Promise<BOMItem[]>, []>(),
  getActiveDocument: jest.fn(),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
  registerCommand: jest.fn(),
  createDialog: jest.fn(),
};

(global as unknown as { eda: typeof mockEda }).eda = mockEda;

// ─── parseBOMItems ─────────────────────────────────────────────────────────────

describe('parseBOMItems', () => {
  it('groups items with the same LCSC part number', () => {
    const rawItems: BOMItem[] = [
      { Designator: 'R1', Value: '10k', Footprint: '0402', LCSC: 'C99999' },
      { Designator: 'R2', Value: '10k', Footprint: '0402', LCSC: 'C99999' },
    ];
    const result = parseBOMItems(rawItems);
    expect(result).toHaveLength(1);
    expect(result[0].designators).toEqual(['R1', 'R2']);
    expect(result[0].quantity).toBe(2);
    expect(result[0].lcscPart).toBe('C99999');
  });

  it('separates items with different LCSC part numbers', () => {
    const rawItems: BOMItem[] = [
      { Designator: 'R1', Value: '10k', Footprint: '0402', LCSC: 'C11111' },
      { Designator: 'C1', Value: '100nF', Footprint: '0402', LCSC: 'C22222' },
    ];
    const result = parseBOMItems(rawItems);
    expect(result).toHaveLength(2);
  });

  it('uses value+footprint as fallback key when LCSC is absent', () => {
    const rawItems: BOMItem[] = [
      { Designator: 'R1', Value: '10k', Footprint: '0402' },
      { Designator: 'R2', Value: '10k', Footprint: '0402' },
      { Designator: 'R3', Value: '10k', Footprint: '0603' }, // different footprint
    ];
    const result = parseBOMItems(rawItems);
    expect(result).toHaveLength(2);
    const groupA = result.find((r) => r.footprint === '0402')!;
    expect(groupA.designators).toEqual(['R1', 'R2']);
    expect(groupA.quantity).toBe(2);
  });

  it('keeps items separate when both LCSC, value, and footprint are all empty', () => {
    const rawItems: BOMItem[] = [
      { Designator: 'U1', Value: '', Footprint: '' },
      { Designator: 'U2', Value: '', Footprint: '' },
    ];
    const result = parseBOMItems(rawItems);
    // Items with completely empty identifiers should NOT be grouped together
    expect(result).toHaveLength(2);
  });

  it('accumulates quantities with explicit Quantity field', () => {
    const rawItems: BOMItem[] = [
      { Designator: 'R1', Value: '10k', Footprint: '0402', LCSC: 'C88888', Quantity: 3 },
      { Designator: 'R2', Value: '10k', Footprint: '0402', LCSC: 'C88888', Quantity: 2 },
    ];
    const result = parseBOMItems(rawItems);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it('returns empty array for empty input', () => {
    expect(parseBOMItems([])).toEqual([]);
  });

  it('normalizes description from Name field when Description is absent', () => {
    const rawItems: BOMItem[] = [
      { Designator: 'U1', Value: 'MCU', Footprint: 'QFP', Name: 'STM32' },
    ];
    const result = parseBOMItems(rawItems);
    expect(result[0].description).toBe('STM32');
  });

  it('trims whitespace from all string fields', () => {
    const rawItems: BOMItem[] = [
      {
        Designator: '  R1  ',
        Value: '  10k  ',
        Footprint: '  0402  ',
        LCSC: '  C12345  ',
      },
    ];
    const result = parseBOMItems(rawItems);
    expect(result[0].designators).toEqual(['R1']);
    expect(result[0].value).toBe('10k');
    expect(result[0].footprint).toBe('0402');
    expect(result[0].lcscPart).toBe('C12345');
  });
});

// ─── analyzeBOM ────────────────────────────────────────────────────────────────

describe('analyzeBOM', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws when no document is active', async () => {
    mockEda.getActiveDocument.mockResolvedValue(null);
    await expect(analyzeBOM()).rejects.toThrow('请先打开一个原理图文件');
  });

  it('throws when the active document is not a schematic', async () => {
    mockEda.getActiveDocument.mockResolvedValue({
      uuid: 'abc',
      title: 'test',
      docType: 'pcb',
    });
    await expect(analyzeBOM()).rejects.toThrow('请切换到原理图');
  });

  it('throws when BOM is empty', async () => {
    mockEda.getActiveDocument.mockResolvedValue({
      uuid: 'abc',
      title: 'test',
      docType: 'schematic',
    });
    mockEda.getBOM.mockResolvedValue([]);
    await expect(analyzeBOM()).rejects.toThrow('未找到BOM数据');
  });

  it('returns analysis result with correct counts', async () => {
    mockEda.getActiveDocument.mockResolvedValue({
      uuid: 'abc',
      title: 'test',
      docType: 'schematic',
    });
    mockEda.getBOM.mockResolvedValue([
      { Designator: 'R1', Value: '10k', Footprint: '0402', LCSC: 'C11111' },
      { Designator: 'R2', Value: '10k', Footprint: '0402', LCSC: 'C11111' },
      { Designator: 'C1', Value: '100nF', Footprint: '0402', LCSC: 'C22222' },
      { Designator: 'U1', Value: 'MCU', Footprint: 'QFP' }, // no LCSC
    ]);

    const result = await analyzeBOM();
    expect(result.uniquePartCount).toBe(3);
    expect(result.totalComponentCount).toBe(4);
    expect(result.missingLcscParts).toHaveLength(1);
    expect(result.missingLcscParts[0].value).toBe('MCU');
  });
});
