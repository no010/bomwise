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
 * LCEDA Pro Extension API Type Declarations
 * Based on: https://prodocs.lceda.cn/cn/api/guide/
 */

/** BOM data item returned by the EDA API */
export interface BOMItem {
  /** Component designator (e.g. "R1", "C1") */
  Designator: string;
  /** Component value (e.g. "10k", "100nF") */
  Value: string;
  /** Footprint library reference */
  Footprint: string;
  /** LCSC part number (e.g. "C12345") */
  LCSC?: string;
  /** Component description */
  Description?: string;
  /** Component name/model */
  Name?: string;
  /** Manufacturer */
  Manufacturer?: string;
  /** Manufacturer part number */
  ManufacturerPartNumber?: string;
  /** Component quantity */
  Quantity?: number;
}

/** Active document information */
export interface EDADocument {
  /** Document UUID */
  uuid: string;
  /** Document title */
  title: string;
  /** Document type: schematic, pcb, etc. */
  docType: string;
  /** Project UUID */
  projectUuid?: string;
}

/** Message API for user notifications */
export interface EDAMessageAPI {
  /** Show a success notification */
  success(text: string): void;
  /** Show an error notification */
  error(text: string): void;
  /** Show a warning notification */
  warning(text: string): void;
  /** Show an info notification */
  info(text: string): void;
}

/** Command registration callback */
export type CommandCallback = () => void | Promise<void>;

/** EDA dialog window reference */
export interface EDADialogWindow {
  /** Show the dialog */
  show(): void;
  /** Close the dialog */
  close(): void;
  /** The iframe element containing the dialog */
  iframe?: HTMLIFrameElement;
}

/** Options for creating a panel/dialog */
export interface EDADialogOptions {
  /** Dialog title */
  title: string;
  /** HTML content to display */
  html: string;
  /** Dialog width in pixels */
  width?: number;
  /** Dialog height in pixels */
  height?: number;
  /** Whether the dialog is resizable */
  resizable?: boolean;
}

/** LCEDA Pro V3 Extension API (window.eda) */
export interface EDAApi {
  /** Get BOM data from the active schematic */
  getBOM(): Promise<BOMItem[]>;
  /** Get the currently active document */
  getActiveDocument(): Promise<EDADocument | null>;
  /** Message notification API */
  message: EDAMessageAPI;
  /**
   * Register an extension command
   * @param commandId - Unique command identifier
   * @param callback - Command handler function
   */
  registerCommand(commandId: string, callback: CommandCallback): void;
  /**
   * Create and show a panel dialog with HTML content
   * @param options - Dialog options
   */
  createDialog(options: EDADialogOptions): EDADialogWindow;
  /**
   * Show an HTML panel (alternative dialog API)
   * @param html - HTML string to display
   * @param title - Panel title
   */
  showPanel?(html: string, title: string): void;
}

declare global {
  interface Window {
    eda: EDAApi;
  }
  const eda: EDAApi;
}
