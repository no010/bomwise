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
 * BOMWise — Intelligent BOM Optimizer for LCEDA Pro
 *
 * Entry point: registers all extension commands and wires up the BOM analysis,
 * alternative parts search, and price/inventory check workflows.
 *
 * Non-system LCEDA API calls used:
 *   1. eda.getActiveDocument()  — identify the open schematic
 *   2. eda.getBOM()             — retrieve schematic BOM data
 *   3. eda.message.*            — user feedback notifications
 *   4. eda.createDialog()       — display the results panel
 */

import { analyzeBOM } from './bom-analyzer.js';
import { findAllAlternatives } from './alt-finder.js';
import { checkPrices } from './price-checker.js';
import { showBOMWiseDialog } from './ui.js';
import type { BOMAnalysisResult } from './bom-analyzer.js';
import type { AlternativeResult } from './alt-finder.js';
import type { PriceCheckResult } from './price-checker.js';

// ─── State ─────────────────────────────────────────────────────────────────────

/** Cache last analysis result so other commands can reuse it. */
let lastAnalysis: BOMAnalysisResult | null = null;
let lastAlternatives: AlternativeResult[] | null = null;
let lastPriceResult: PriceCheckResult | null = null;

// ─── Command handlers ──────────────────────────────────────────────────────────

/**
 * Command: bomwise.analyze
 * Full BOM analysis — fetches BOM, checks prices, finds alternatives,
 * then shows the combined results dialog.
 */
async function cmdAnalyze(): Promise<void> {
  try {
    eda.message.info('BOMWise: 正在分析BOM...');

    // Step 1: Fetch and parse the BOM (uses getActiveDocument + getBOM APIs)
    const analysis = await analyzeBOM();
    lastAnalysis = analysis;
    lastAlternatives = null;
    lastPriceResult = null;

    const { uniquePartCount, totalComponentCount, missingLcscParts } = analysis;
    eda.message.success(
      `BOM解析完成：${uniquePartCount} 种元器件，共 ${totalComponentCount} 个`
    );

    if (missingLcscParts.length > 0) {
      eda.message.warning(
        `有 ${missingLcscParts.length} 种元器件缺少LCSC编号，部分功能可能受限`
      );
    }

    // Step 2: Query prices (runs in background, non-blocking for the dialog)
    checkPrices(analysis.items)
      .then((priceResult) => {
        lastPriceResult = priceResult;
        const { outOfStockParts, notFoundParts } = priceResult;
        if (outOfStockParts.length > 0) {
          eda.message.warning(
            `${outOfStockParts.length} 个元器件库存不足，请关注替代料推荐`
          );
        }
        if (notFoundParts.length > 0) {
          eda.message.warning(`${notFoundParts.length} 个元器件未在立创商城找到`);
        }
      })
      .catch(() => {
        // Price check failure is non-fatal
        eda.message.warning('价格查询失败，请检查网络连接');
      });

    // Step 3: Show dialog immediately with BOM data (price fills in later)
    showBOMWiseDialog({
      analysisResult: analysis,
      alternatives: lastAlternatives ?? undefined,
      priceResult: lastPriceResult ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    eda.message.error(`BOMWise 分析失败: ${message}`);
  }
}

/**
 * Command: bomwise.findAlternatives
 * Find alternative parts for all BOM items and show the dialog.
 */
async function cmdFindAlternatives(): Promise<void> {
  try {
    // Re-fetch BOM if not cached
    if (!lastAnalysis) {
      eda.message.info('BOMWise: 正在获取BOM数据...');
      lastAnalysis = await analyzeBOM();
    }

    eda.message.info(
      `BOMWise: 正在为 ${lastAnalysis.uniquePartCount} 种元器件查找替代料...`
    );

    const alternatives = await findAllAlternatives(lastAnalysis.items);
    lastAlternatives = alternatives;

    const foundCount = alternatives.filter((r) => r.found).length;
    eda.message.success(
      `替代料查找完成：找到 ${foundCount} / ${lastAnalysis.uniquePartCount} 种元器件的替代方案`
    );

    showBOMWiseDialog({
      analysisResult: lastAnalysis,
      alternatives,
      priceResult: lastPriceResult ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    eda.message.error(`查找替代料失败: ${message}`);
  }
}

/**
 * Command: bomwise.checkPrices
 * Query real-time price and inventory data and show the dialog.
 */
async function cmdCheckPrices(): Promise<void> {
  try {
    // Re-fetch BOM if not cached
    if (!lastAnalysis) {
      eda.message.info('BOMWise: 正在获取BOM数据...');
      lastAnalysis = await analyzeBOM();
    }

    const priceResult = await checkPrices(lastAnalysis.items);
    lastPriceResult = priceResult;

    eda.message.success(
      `价格查询完成，估算总成本 ¥${priceResult.totalEstimatedCost.toFixed(2)}`
    );

    showBOMWiseDialog({
      analysisResult: lastAnalysis,
      alternatives: lastAlternatives ?? undefined,
      priceResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    eda.message.error(`价格查询失败: ${message}`);
  }
}

// ─── Extension registration ────────────────────────────────────────────────────

/**
 * Register BOMWise commands with the LCEDA Pro extension API.
 * This block runs once when the extension is loaded.
 */
eda.registerCommand('bomwise.analyze', cmdAnalyze);
eda.registerCommand('bomwise.findAlternatives', cmdFindAlternatives);
eda.registerCommand('bomwise.checkPrices', cmdCheckPrices);

// Notify the user that the extension is ready
eda.message.success('BOMWise 已加载 — 在工具栏或扩展菜单中找到 "BOM智能优化" 入口');
