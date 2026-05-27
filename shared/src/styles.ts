/**
 * Style number → visual highlight color mapping.
 * Single source of truth, mirrored in CLAUDE.md.
 */

export type StyleKind = 'marker' | 'underline' | 'special';

export interface StyleSpec {
  kind: StyleKind;
  /** Japanese display name */
  color: string;
  /** Approximate hex */
  hex: string;
}

export const STYLE_MAP: Record<number, StyleSpec> = {
  0:  { kind: 'marker',    color: '黄',       hex: '#f5ea84' },
  1:  { kind: 'marker',    color: '緑',       hex: '#cded83' },
  2:  { kind: 'marker',    color: '青',       hex: '#b5d3eb' },
  3:  { kind: 'marker',    color: '赤',       hex: '#eaadbc' },
  4:  { kind: 'marker',    color: '紫',       hex: '#cdb0e9' },
  5:  { kind: 'underline', color: '赤',       hex: '#c34235' },
  6:  { kind: 'underline', color: '青',       hex: '#2036b9' },
  7:  { kind: 'underline', color: '緑',       hex: '#71954e' },
  8:  { kind: 'underline', color: '黄',       hex: '#e1cd6e' },
  9:  { kind: 'underline', color: '紫',       hex: '#c761d1' },
  10: { kind: 'underline', color: 'オレンジ', hex: '#d79553' },
  11: { kind: 'marker',    color: 'オレンジ', hex: '#efc07b' },
  12: { kind: 'underline', color: 'グレー',   hex: '#e6e6db' },
  13: { kind: 'special',   color: '描画',     hex: '#000000' },
  104:{ kind: 'marker',    color: 'グレー(暗記隠し)', hex: '#b4b2af' },
};

export const MARKER_STYLES = [0, 1, 2, 3, 4, 11, 104] as const;
export const UNDERLINE_STYLES = [8, 7, 6, 5, 9, 10, 12] as const;
export const MEMORIZATION_HIDE_STYLE = 104 as const;
export const DRAWING_STYLE = 13 as const;

export function styleToCssClass(style: number): string {
  const spec = STYLE_MAP[style];
  if (!spec) return 'sel-unknown';
  const colorSlug = spec.color
    .replace('オレンジ', 'orange')
    .replace('グレー(暗記隠し)', 'mnemonic')
    .replace('グレー', 'gray')
    .replace('黄', 'yellow')
    .replace('緑', 'green')
    .replace('青', 'blue')
    .replace('赤', 'red')
    .replace('紫', 'purple')
    .replace('描画', 'drawing');
  return `sel-${spec.kind}-${colorSlug}`;
}
