# BOMWise — BOM智能优化器

> Intelligent BOM optimizer plugin for LCEDA Pro (嘉立创EDA专业版).  
> Analyze BOM with one click · Smart alternative parts recommendation · Real-time inventory & price check

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## 功能简介

| 功能 | 说明 |
|------|------|
| ⚡ **一键BOM分析** | 读取当前原理图BOM，解析元器件列表，统计缺料情况 |
| 🔍 **替代料推荐** | 自动搜索立创商城，为每个物料推荐最多5个可替代型号 |
| 💰 **价格&库存查询** | 实时查询立创商城价格阶梯与库存数量，估算BOM总成本 |

---

## 安装方法

### 方式一：从源码构建

```bash
# 1. 克隆仓库
git clone https://github.com/no010/bomwise.git
cd bomwise

# 2. 安装依赖
npm install

# 3. 编译 TypeScript
npm run build
```

### 方式二：直接使用发布包

从 [Releases](https://github.com/no010/bomwise/releases) 下载最新版本，解压后参照下方安装步骤。

### 安装到嘉立创EDA专业版

1. 打开嘉立创EDA专业版（V3）
2. 菜单栏：**扩展** → **管理扩展**
3. 点击 **安装本地扩展**，选择本项目根目录（含 `extension.json`）
4. 重启EDA，在 **扩展菜单** 或 **原理图工具栏** 即可看到 BOMWise 入口

---

## 使用方法

### 命令列表

| 命令 | 说明 |
|------|------|
| `BOM智能优化` | 一键完成BOM分析 + 价格查询，并打开结果面板 |
| `查找替代料` | 为BOM中每个物料搜索可替代型号 |
| `查询价格与库存` | 批量查询立创商城实时价格与库存 |

### 操作步骤

1. 在嘉立创EDA中打开原理图
2. 点击工具栏 **⚡ BOMWise** 按钮，或从 **扩展** 菜单选择 **BOM智能优化**
3. 等待分析完成，结果面板自动弹出，包含三个标签页：
   - **BOM清单**：完整元器件列表，带立创商城跳转链接
   - **价格&库存**：各物料实时价格、库存状态与小计
   - **替代料推荐**：按匹配度排序的可替代型号

---

## 项目结构

```
bomwise/
├── src/
│   ├── index.ts          # 入口：注册扩展命令
│   ├── bom-analyzer.ts   # BOM分析（调用 getBOM / getActiveDocument API）
│   ├── alt-finder.ts     # 替代料搜索（调用立创商城 API）
│   ├── price-checker.ts  # 价格库存查询（调用立创商城 API + message API）
│   ├── ui.ts             # HTML结果面板（调用 createDialog API）
│   └── eda-api.d.ts      # 嘉立创EDA API 类型声明
├── extension.json         # 扩展配置清单
├── package.json
├── tsconfig.json
└── README.md
```

---

## 使用的 EDA API

本插件使用了以下 **4 个非系统类嘉立创EDA API**：

| API | 模块 | 用途 |
|-----|------|------|
| `eda.getActiveDocument()` | `bom-analyzer.ts` | 获取当前打开的文档信息 |
| `eda.getBOM()` | `bom-analyzer.ts` | 读取原理图BOM数据 |
| `eda.message.*` | `price-checker.ts`, `index.ts` | 用户操作反馈通知 |
| `eda.createDialog()` | `ui.ts` | 弹出结果展示面板 |

---

## 开发

```bash
# 监听模式（自动重新编译）
npm run build:watch

# 清理构建产物
npm run clean
```

---

## 许可证

本项目基于 [Apache-2.0](LICENSE) 协议开源。

```
Copyright 2024 BOMWise Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
