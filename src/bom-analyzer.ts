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
 * BOM Analyzer Module
 *
 * Fetches and parses BOM data from the active LCEDA schematic using the
 * `getBOM()` and `getActiveDocument()` APIs.
 */

import type { BOMItem, EDADocument } from './eda-api.js';

/** Parsed and normalized BOM item */
export interface ParsedBOMItem {
  /** LCSC part number */
  lcscPart: string;
  /** Component designators (may contain multiple, e.g. "R1,R2,R3") */
  designators: string[];
  /** Component value */
  value: string;
  /** Footprint */
  footprint: string;
  /** Component description */
  description: string;
  /** Manufacturer */
  manufacturer: string;
  /** Manufacturer part number */
  mfgPartNumber: string;
  /** Total quantity needed */
  quantity: number;
}

/** BOM analysis result */
export interface BOMAnalysisResult {
  /** Document info */
  document: EDADocument;
  /** Parsed BOM items, grouped by part number */
  items: ParsedBOMItem[];
  /** Total unique part count */
  uniquePartCount: number;
  /** Total component count */
  totalComponentCount: number;
  /** Items missing LCSC part numbers */
  missingLcscParts: ParsedBOMItem[];
  /** Timestamp of analysis */
  analyzedAt: Date;
}

/**
 * Fetch and parse the BOM from the active LCEDA schematic.
 *
 * Uses the EDA API's `getActiveDocument()` and `getBOM()` calls — both are
 * non-system-class APIs required by the project specification.
 *
 * @throws Error if no document is active or if the BOM cannot be retrieved
 */
export async function analyzeBOM(): Promise<BOMAnalysisResult> {
  // Non-system API call #1: getActiveDocument()
  const activeDoc = await eda.getActiveDocument();

  if (!activeDoc) {
    throw new Error('请先打开一个原理图文件');
  }

  if (activeDoc.docType !== 'schematic') {
    throw new Error(`当前文档类型为 "${activeDoc.docType}"，请切换到原理图`);
  }

  // Non-system API call #2: getBOM()
  const rawItems = await eda.getBOM();

  if (!rawItems || rawItems.length === 0) {
    throw new Error('未找到BOM数据，请确认原理图中有元器件');
  }

  const parsed = parseBOMItems(rawItems);
  const missingLcscParts = parsed.filter((item) => !item.lcscPart);

  return {
    document: activeDoc,
    items: parsed,
    uniquePartCount: parsed.length,
    totalComponentCount: parsed.reduce((sum, item) => sum + item.quantity, 0),
    missingLcscParts,
    analyzedAt: new Date(),
  };
}

/**
 * Parse raw BOM items from the EDA API into normalized ParsedBOMItem objects.
 * Groups items with the same LCSC part number (or value+footprint fallback).
 *
 * @internal exported for unit testing
 */
export function parseBOMItems(rawItems: BOMItem[]): ParsedBOMItem[] {
  const groupMap = new Map<string, ParsedBOMItem>();

  for (const raw of rawItems) {
    const lcscPart = (raw.LCSC ?? '').trim();
    const value = (raw.Value ?? '').trim();
    const footprint = (raw.Footprint ?? '').trim();
    const designator = (raw.Designator ?? '').trim();

    // Use LCSC part number as key; fall back to value+footprint, then designator
    const valueFpKey = `${value}|${footprint}`;
    const groupKey = lcscPart || (valueFpKey !== '|' ? valueFpKey : `__nokey__${designator}`);

    if (groupMap.has(groupKey)) {
      const existing = groupMap.get(groupKey)!;
      // Merge additional designators
      if (designator && !existing.designators.includes(designator)) {
        existing.designators.push(designator);
      }
      // Sum quantities
      existing.quantity += raw.Quantity ?? 1;
    } else {
      groupMap.set(groupKey, {
        lcscPart,
        designators: designator ? [designator] : [],
        value,
        footprint,
        description: (raw.Description ?? raw.Name ?? '').trim(),
        manufacturer: (raw.Manufacturer ?? '').trim(),
        mfgPartNumber: (raw.ManufacturerPartNumber ?? '').trim(),
        quantity: raw.Quantity ?? 1,
      });
    }
  }

  return Array.from(groupMap.values());
}
