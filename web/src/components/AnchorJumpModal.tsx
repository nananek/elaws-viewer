import { useEffect, useMemo, useRef, useState } from 'react';
import type { LawBody } from '@elaws/shared/types';
import { buildCompoundAnchor } from '@elaws/shared/anchor';
import {
  buildLawIndex,
  hasSubArticle,
  hasMultipleParagraphs,
  hasItemsForParagraph,
} from './anchorStructure.js';

type FieldKey = 'article' | 'of' | 'paragraph' | 'item';
const FIELD_LABEL: Record<FieldKey, string> = {
  article: '条',
  of: 'の',
  paragraph: '項',
  item: '号',
};
const PREV: Record<FieldKey, FieldKey | null> = {
  article: null,
  of: 'article',
  paragraph: 'of',
  item: 'paragraph',
};

// Explicit grid-placement classes so Tailwind keeps them in the build.
const DIGIT_BTNS: Array<{ d: string; cls: string }> = [
  { d: '7', cls: 'col-start-1 row-start-2' },
  { d: '8', cls: 'col-start-2 row-start-2' },
  { d: '9', cls: 'col-start-3 row-start-2' },
  { d: '4', cls: 'col-start-1 row-start-3' },
  { d: '5', cls: 'col-start-2 row-start-3' },
  { d: '6', cls: 'col-start-3 row-start-3' },
  { d: '1', cls: 'col-start-1 row-start-4' },
  { d: '2', cls: 'col-start-2 row-start-4' },
  { d: '3', cls: 'col-start-3 row-start-4' },
];

interface Props {
  body: LawBody;
  onClose: () => void;
  onJump: (anchor: string) => void;
}

/**
 * Numeric-pad jump modal.
 *
 * Input model:
 *   0-9      append digit to active field
 *   .        advance to next applicable field (smart skip based on law structure)
 *   Enter    1st press: confirm current field (label = field name)
 *            2nd press / confirmed state: jump (label = 移動)
 *   Backspace  delete one digit; if field empty, rewind to previous field
 *   Esc      close
 *
 * Example: `899.2.1` Enter Enter → 第899条の2 第1項 へジャンプ
 */
export function AnchorJumpModal({ body, onClose, onJump }: Props) {
  const index = useMemo(() => buildLawIndex(body), [body]);
  const [vals, setVals] = useState<Record<FieldKey, string>>({
    article: '',
    of: '',
    paragraph: '',
    item: '',
  });
  const [active, setActive] = useState<FieldKey>('article');
  const [confirmed, setConfirmed] = useState(false);

  function articleKey(): string | null {
    const n = parseInt(vals.article, 10);
    if (!Number.isFinite(n)) return null;
    const m = vals.of ? parseInt(vals.of, 10) : null;
    return m != null && Number.isFinite(m) ? `${n}_${m}` : `${n}`;
  }

  function nextFieldOf(from: FieldKey): FieldKey | null {
    const n = parseInt(vals.article, 10);
    if (!Number.isFinite(n)) return null;
    const ak = articleKey();
    if (from === 'article') {
      if (hasSubArticle(index, n)) return 'of';
      if (ak && hasMultipleParagraphs(index, ak)) return 'paragraph';
      return null;
    }
    if (from === 'of') {
      if (ak && hasMultipleParagraphs(index, ak)) return 'paragraph';
      return null;
    }
    if (from === 'paragraph') {
      const p = parseInt(vals.paragraph, 10);
      if (!Number.isFinite(p) || !ak) return null;
      if (hasItemsForParagraph(index, ak, p)) return 'item';
      return null;
    }
    return null;
  }

  function appendDigit(d: string) {
    setConfirmed(false);
    setVals((prev) => ({ ...prev, [active]: prev[active] + d }));
  }

  function backspace() {
    setConfirmed(false);
    if (vals[active].length > 0) {
      setVals((prev) => ({ ...prev, [active]: prev[active].slice(0, -1) }));
    } else {
      const prev = PREV[active];
      if (prev) setActive(prev);
    }
  }

  function advance() {
    if (!vals[active]) return; // nothing typed yet
    const nxt = nextFieldOf(active);
    if (!nxt) return; // no applicable next field
    setActive(nxt);
    setConfirmed(false);
  }

  function pressEnter() {
    if (confirmed) {
      submit();
      return;
    }
    if (!vals[active]) {
      // Empty field — only allow jump if some earlier field has content
      if (vals.article) submit();
      return;
    }
    setConfirmed(true);
  }

  function submit() {
    const article = parseInt(vals.article, 10);
    if (!Number.isFinite(article)) return;
    const anchor = buildCompoundAnchor({
      article,
      of: vals.of ? parseInt(vals.of, 10) : null,
      paragraph: vals.paragraph ? parseInt(vals.paragraph, 10) : null,
      item: vals.item ? parseInt(vals.item, 10) : null,
    });
    onJump(anchor);
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Block ALL keys from leaking to global shortcuts (e.g. `/` law search).
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        pressEnter();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDigit(e.key);
        return;
      }
      if (e.key === '.' || e.key === '+') {
        e.preventDefault();
        advance();
        return;
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions);
  });

  const enterLabel = confirmed ? '移動' : FIELD_LABEL[active];
  const nextOfCurrent = nextFieldOf(active);
  const dotEnabled = !!nextOfCurrent && !!vals[active];
  const dotHint = nextOfCurrent ? FIELD_LABEL[nextOfCurrent] : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="条文番号ジャンプ"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30"
      onClick={onClose}
      data-testid="anchor-jump-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border-t sm:border border-neutral-300 sm:rounded-md shadow-lg w-full sm:max-w-sm p-4 space-y-3"
      >
        <div
          className="heading-gothic text-xl text-center py-2 min-h-[2.5rem]"
          data-testid="natural-label"
        >
          {renderNaturalLabel(vals, active, confirmed)}
        </div>

        {/* Physical numpad layout: 4 columns × 5 rows.
              row1: . . ⌫ ×
              row2: 7 8 9 + (spans 2 rows)
              row3: 4 5 6 +
              row4: 1 2 3 E (spans 2 rows; label dynamic)
              row5: 0 (spans 2 cols) . E
            ` +` is aliased to `.` (next-field advance) — same action, two physical keys. */}
        <div
          className="grid grid-cols-4 grid-rows-5 gap-2 text-lg font-mono select-none"
          data-testid="keypad"
        >
          {/* row 1: top right backspace + close */}
          <button
            type="button"
            onClick={backspace}
            className="col-start-3 row-start-1 bg-white border border-neutral-300 rounded min-h-12 py-2 hover:bg-neutral-50 text-sm"
            aria-label="一文字削除"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={onClose}
            className="col-start-4 row-start-1 bg-white border border-neutral-300 rounded min-h-12 py-2 hover:bg-neutral-50 text-sm"
            aria-label="閉じる"
          >
            ×
          </button>

          {/* digits 7-9, 4-6, 1-3 — explicit grid placement so Tailwind keeps the classes */}
          {DIGIT_BTNS.map(({ d, cls }) => (
            <button
              key={d}
              type="button"
              onClick={() => appendDigit(d)}
              className={`bg-white border border-neutral-300 rounded min-h-12 py-2 hover:bg-neutral-50 ${cls}`}
            >
              {d}
            </button>
          ))}

          {/* + spans rows 2-3, col 4 — alias for . (advance) */}
          <button
            type="button"
            onClick={advance}
            disabled={!dotEnabled}
            className="col-start-4 row-start-2 row-span-2 bg-white border border-neutral-300 rounded min-h-12 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm flex flex-col items-center justify-center"
            data-testid="plus-btn"
            title="次のフィールドへ ( + or . )"
          >
            <span>+</span>
            {dotHint && <span className="text-xs text-neutral-500 mt-0.5">→ {dotHint}</span>}
          </button>

          {/* 0 spans cols 1-2, row 5 */}
          <button
            type="button"
            onClick={() => appendDigit('0')}
            className="col-start-1 col-span-2 row-start-5 bg-white border border-neutral-300 rounded min-h-12 py-2 hover:bg-neutral-50"
          >
            0
          </button>

          {/* . at col 3 row 5 — same action as + */}
          <button
            type="button"
            onClick={advance}
            disabled={!dotEnabled}
            className="col-start-3 row-start-5 bg-white border border-neutral-300 rounded min-h-12 py-2 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="dot-btn"
            title="次のフィールドへ ( . or + )"
          >
            .
          </button>

          {/* Enter spans rows 4-5, col 4 */}
          <button
            type="button"
            onClick={pressEnter}
            className="col-start-4 row-start-4 row-span-2 bg-ink text-paper border border-ink rounded min-h-12 hover:opacity-90 text-sm flex items-center justify-center"
            data-testid="enter-btn"
          >
            {enterLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderNaturalLabel(
  vals: Record<FieldKey, string>,
  active: FieldKey,
  confirmed: boolean,
) {
  const cls = (key: FieldKey) =>
    !confirmed && active === key
      ? 'underline decoration-2 decoration-ink animate-pulse'
      : '';
  const placeholder = (key: FieldKey) =>
    !confirmed && active === key ? '_' : '';

  const parts: React.ReactNode[] = [];
  parts.push(
    <span key="a-pre">第</span>,
    <span key="a-val" className={cls('article')}>
      {vals.article || placeholder('article')}
    </span>,
    <span key="a-suf">条</span>,
  );
  if (active === 'of' || vals.of) {
    parts.push(
      <span key="o-pre">の</span>,
      <span key="o-val" className={cls('of')}>
        {vals.of || placeholder('of')}
      </span>,
    );
  }
  if (active === 'paragraph' || vals.paragraph) {
    parts.push(
      <span key="p-pre"> 第</span>,
      <span key="p-val" className={cls('paragraph')}>
        {vals.paragraph || placeholder('paragraph')}
      </span>,
      <span key="p-suf">項</span>,
    );
  }
  if (active === 'item' || vals.item) {
    parts.push(
      <span key="i-pre">第</span>,
      <span key="i-val" className={cls('item')}>
        {vals.item || placeholder('item')}
      </span>,
      <span key="i-suf">号</span>,
    );
  }
  return parts;
}
