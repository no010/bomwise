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
 * UI Module
 *
 * Generates the HTML dialog for displaying BOM analysis, alternative parts,
 * and pricing results within the LCEDA Pro extension panel.
 */

import type { BOMAnalysisResult, ParsedBOMItem } from './bom-analyzer.js';
import type { AlternativeResult } from './alt-finder.js';
import type { PriceCheckResult } from './price-checker.js';

/** All data needed to render the full BOMWise results panel */
export interface BOMWiseUIData {
  analysisResult: BOMAnalysisResult;
  alternatives?: AlternativeResult[];
  priceResult?: PriceCheckResult;
}

/**
 * Show the BOMWise results dialog using the LCEDA `createDialog` API.
 * Falls back to `showPanel` if `createDialog` is not available.
 */
export function showBOMWiseDialog(data: BOMWiseUIData): void {
  const html = buildHtml(data);

  if (typeof eda.createDialog === 'function') {
    const dialog = eda.createDialog({
      title: 'BOMWise - BOM智能优化器',
      html,
      width: 960,
      height: 680,
      resizable: true,
    });
    dialog.show();
  } else if (typeof eda.showPanel === 'function') {
    eda.showPanel(html, 'BOMWise - BOM智能优化器');
  } else {
    // Last resort: open in a new window
    const win = window.open('', 'BOMWise', 'width=960,height=680,resizable=yes');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }
}

// ─── HTML builders ─────────────────────────────────────────────────────────────

function buildHtml(data: BOMWiseUIData): string {
  const { analysisResult, alternatives, priceResult } = data;

  const totalCostStr = priceResult
    ? `¥${priceResult.totalEstimatedCost.toFixed(2)}`
    : '未查询';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>BOMWise - BOM智能优化器</title>
<style>
  :root {
    --primary: #1a73e8;
    --success: #188038;
    --warning: #f9ab00;
    --danger: #d93025;
    --bg: #ffffff;
    --surface: #f8f9fa;
    --border: #dadce0;
    --text: #202124;
    --text-secondary: #5f6368;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         font-size: 13px; color: var(--text); background: var(--bg); }
  .header { background: var(--primary); color: #fff; padding: 12px 16px;
            display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 16px; font-weight: 600; }
  .header .badge { background: rgba(255,255,255,0.2); padding: 2px 8px;
                   border-radius: 12px; font-size: 11px; }
  .stats { display: flex; gap: 12px; padding: 12px 16px; background: var(--surface);
           border-bottom: 1px solid var(--border); }
  .stat { display: flex; flex-direction: column; align-items: center;
          background: #fff; border: 1px solid var(--border); border-radius: 8px;
          padding: 8px 16px; min-width: 100px; }
  .stat .value { font-size: 22px; font-weight: 700; color: var(--primary); }
  .stat .label { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
  .tabs { display: flex; border-bottom: 2px solid var(--border); padding: 0 16px;
          background: var(--surface); }
  .tab { padding: 10px 16px; cursor: pointer; border-bottom: 2px solid transparent;
         margin-bottom: -2px; font-weight: 500; color: var(--text-secondary); }
  .tab.active { color: var(--primary); border-bottom-color: var(--primary); }
  .tab-content { display: none; padding: 12px 16px; overflow: auto; max-height: 460px; }
  .tab-content.active { display: block; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: var(--surface); padding: 8px 10px; text-align: left;
       font-weight: 600; border-bottom: 2px solid var(--border); position: sticky; top: 0; }
  td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:hover td { background: #f0f4ff; }
  .tag { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px;
         font-weight: 600; }
  .tag-green { background: #e6f4ea; color: var(--success); }
  .tag-red { background: #fce8e6; color: var(--danger); }
  .tag-yellow { background: #fef7e0; color: #b06000; }
  .tag-gray { background: #f1f3f4; color: var(--text-secondary); }
  .link { color: var(--primary); text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .warn-box { background: #fef7e0; border: 1px solid #f9ab00; border-radius: 6px;
              padding: 8px 12px; margin: 8px 0; display: flex; gap: 8px; }
  .empty { text-align: center; padding: 40px 0; color: var(--text-secondary); }
  .alt-section { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .alt-section .part-header { background: var(--surface); padding: 8px 12px;
                               font-weight: 600; border-bottom: 1px solid var(--border); }
  .alt-section table { margin: 0; }
</style>
</head>
<body>
<div class="header">
  <h1>⚡ BOMWise — BOM智能优化器</h1>
  <span class="badge">v1.0.0</span>
</div>

<div class="stats">
  <div class="stat">
    <span class="value">${analysisResult.uniquePartCount}</span>
    <span class="label">独立物料种数</span>
  </div>
  <div class="stat">
    <span class="value">${analysisResult.totalComponentCount}</span>
    <span class="label">元器件总数</span>
  </div>
  <div class="stat">
    <span class="value">${analysisResult.missingLcscParts.length}</span>
    <span class="label">缺少LCSC编号</span>
  </div>
  <div class="stat">
    <span class="value">${totalCostStr}</span>
    <span class="label">估算总成本</span>
  </div>
</div>

<div class="tabs">
  <div class="tab active" onclick="switchTab('bom')">BOM清单</div>
  <div class="tab" onclick="switchTab('price')">价格&库存</div>
  <div class="tab" onclick="switchTab('alt')">替代料推荐</div>
</div>

<div id="tab-bom" class="tab-content active">
  ${buildBOMTable(analysisResult.items)}
</div>
<div id="tab-price" class="tab-content">
  ${buildPriceTable(analysisResult.items, priceResult)}
</div>
<div id="tab-alt" class="tab-content">
  ${buildAlternativesSection(alternatives)}
</div>

<script>
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const tabs = ['bom', 'price', 'alt'];
    t.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}
</script>
</body>
</html>`;
}

function buildBOMTable(items: ParsedBOMItem[]): string {
  if (items.length === 0) {
    return '<div class="empty">没有找到BOM数据</div>';
  }

  const rows = items
    .map((item) => {
      const lcscTag = item.lcscPart
        ? `<a class="link" href="https://item.szlcsc.com/search?q=${encodeURIComponent(item.lcscPart)}" target="_blank">${escapeHtml(item.lcscPart)}</a>`
        : '<span class="tag tag-yellow">未填写</span>';

      return `<tr>
      <td>${escapeHtml(item.designators.join(', '))}</td>
      <td>${escapeHtml(item.value)}</td>
      <td>${escapeHtml(item.footprint)}</td>
      <td>${lcscTag}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${item.quantity}</td>
    </tr>`;
    })
    .join('');

  return `<table>
    <thead><tr>
      <th>位号</th><th>值</th><th>封装</th><th>LCSC编号</th><th>描述</th><th>数量</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildPriceTable(
  items: ParsedBOMItem[],
  priceResult?: PriceCheckResult
): string {
  if (!priceResult) {
    return '<div class="empty">价格数据尚未加载，请使用"查询价格与库存"命令</div>';
  }

  const rows = items
    .filter((item) => item.lcscPart)
    .map((item) => {
      const info = priceResult.partPrices.get(item.lcscPart);
      if (!info) {
        return `<tr>
          <td>${escapeHtml(item.lcscPart)}</td>
          <td>${escapeHtml(item.value)}</td>
          <td>${item.quantity}</td>
          <td colspan="3"><span class="tag tag-red">未找到</span></td>
        </tr>`;
      }

      const stockTag = info.available
        ? `<span class="tag tag-green">${info.stockQty.toLocaleString()}</span>`
        : `<span class="tag tag-red">${info.stockQty.toLocaleString()} (不足)</span>`;

      return `<tr>
        <td><a class="link" href="${escapeHtml(info.url)}" target="_blank">${escapeHtml(item.lcscPart)}</a></td>
        <td>${escapeHtml(item.value)}</td>
        <td>${item.quantity}</td>
        <td>${stockTag}</td>
        <td>¥${info.effectiveUnitPrice.toFixed(4)}</td>
        <td>¥${info.totalCost.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const totalRow = `<tr style="font-weight:700; background:var(--surface)">
    <td colspan="5" style="text-align:right">估算总成本</td>
    <td>¥${priceResult.totalEstimatedCost.toFixed(2)}</td>
  </tr>`;

  return `<table>
    <thead><tr>
      <th>LCSC编号</th><th>值</th><th>需求数量</th><th>库存</th><th>单价</th><th>小计</th>
    </tr></thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>`;
}

function buildAlternativesSection(alternatives?: AlternativeResult[]): string {
  if (!alternatives || alternatives.length === 0) {
    return '<div class="empty">替代料数据尚未加载，请使用"查找替代料"命令</div>';
  }

  const sections = alternatives
    .filter((r) => r.found)
    .map((result) => {
      const origLabel = result.original.lcscPart || result.original.value;
      const altRows = result.alternatives
        .map(
          (alt) => `<tr>
          <td><a class="link" href="${escapeHtml(alt.url)}" target="_blank">${escapeHtml(alt.lcscPart)}</a></td>
          <td>${escapeHtml(alt.description)}</td>
          <td>${escapeHtml(alt.manufacturer)}</td>
          <td>${alt.stockQty > 0 ? `<span class="tag tag-green">${alt.stockQty.toLocaleString()}</span>` : '<span class="tag tag-red">无货</span>'}</td>
          <td>¥${alt.unitPrice.toFixed(4)}</td>
          <td>${renderScore(alt.similarityScore)}</td>
        </tr>`
        )
        .join('');

      return `<div class="alt-section">
        <div class="part-header">🔧 原件: ${escapeHtml(origLabel)}
          &nbsp;·&nbsp; <small style="color:var(--text-secondary)">${escapeHtml(result.original.description)}</small>
        </div>
        <table>
          <thead><tr><th>替代料编号</th><th>描述</th><th>品牌</th><th>库存</th><th>单价</th><th>匹配度</th></tr></thead>
          <tbody>${altRows}</tbody>
        </table>
      </div>`;
    })
    .join('');

  return sections || '<div class="empty">未找到任何替代料推荐</div>';
}

function renderScore(score: number): string {
  const color =
    score >= 70 ? 'tag-green' : score >= 40 ? 'tag-yellow' : 'tag-gray';
  return `<span class="tag ${color}">${score}%</span>`;
}

/** @internal exported for unit testing */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
