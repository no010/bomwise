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

import { escapeHtml } from '../ui.js';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('A&B')).toBe('A&amp;B');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a>b')).toBe('a&gt;b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns unchanged string with no special characters', () => {
    expect(escapeHtml('Hello BOMWise 123')).toBe('Hello BOMWise 123');
  });

  it('handles an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes all special characters combined (XSS payload)', () => {
    const xss = '<img src="x" onerror=\'alert(1)\'>&';
    const escaped = escapeHtml(xss);
    expect(escaped).toBe('&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;');
  });

  it('escapes Chinese characters - passes through unchanged', () => {
    expect(escapeHtml('嘉立创EDA')).toBe('嘉立创EDA');
  });
});
