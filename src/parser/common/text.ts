// Text normalization and section splitting (SoT §9.2 steps 1 and 3).

export function normalizeClipboard(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[​‎‏﻿]/g, '')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.trim());
}

export interface Line { text: string; index: number }

/** Splits on separator lines; empty lines are dropped. Line indexes refer to the normalized text. */
export function splitSections(lines: readonly string[], isSeparator: (line: string) => boolean): Line[][] {
  const sections: Line[][] = [[]];
  lines.forEach((text, index) => {
    if (isSeparator(text)) sections.push([]);
    else if (text.length > 0) sections.at(-1)?.push({ text, index });
  });
  return sections.filter((s) => s.length > 0);
}
