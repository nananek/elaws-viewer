import { useEffect, useRef, useState } from 'react';
import { buildCompoundAnchor } from '@elaws/shared/anchor';

type FieldKey = 'article' | 'of' | 'paragraph' | 'item';
const ORDER: FieldKey[] = ['article', 'of', 'paragraph', 'item'];
const LABELS: Record<FieldKey, string> = {
  article: '条',
  of: 'の',
  paragraph: '項',
  item: '号',
};

interface Props {
  onClose: () => void;
  onJump: (anchor: string) => void;
}

/**
 * Numeric-pad jump modal for "条N (の M) 項 P 号 I".
 *
 * Key bindings (inside the modal):
 *   0–9         append to active field
 *   /           focus 条 → の
 *   *           focus の → 項
 *   -           focus 項 → 号
 *   +           focus 号 (no-op; reserved for future)
 *   Backspace   delete one char from active field
 *   Enter       submit
 *   Esc         close
 *
 * Touch users can also tap the numeric pad rendered below the fields.
 */
export function AnchorJumpModal({ onClose, onJump }: Props) {
  const [active, setActive] = useState<FieldKey>('article');
  const [vals, setVals] = useState<Record<FieldKey, string>>({
    article: '',
    of: '',
    paragraph: '',
    item: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  function append(d: string) {
    setVals((prev) => ({ ...prev, [active]: prev[active] + d }));
  }
  function backspace() {
    setVals((prev) => ({ ...prev, [active]: prev[active].slice(0, -1) }));
  }
  function focusNext(target: FieldKey) {
    setActive(target);
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
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        append(e.key);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        focusNext('of');
        return;
      }
      if (e.key === '*') {
        e.preventDefault();
        focusNext('paragraph');
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        focusNext('item');
        return;
      }
      if (e.key === '+') {
        e.preventDefault();
        focusNext('item');
        return;
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions);
  }, [active, vals]);

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
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border-t sm:border border-neutral-300 sm:rounded-md shadow-lg w-full sm:max-w-sm p-4 space-y-3"
      >
        <div className="heading-gothic flex items-end gap-2 text-base">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              className={`flex items-baseline gap-1 px-2 py-1 rounded border ${
                active === k
                  ? 'border-ink bg-white'
                  : 'border-neutral-200 bg-white/50 text-neutral-500'
              }`}
              data-testid={`field-${k}`}
              aria-pressed={active === k}
            >
              <span className="text-xs">{LABELS[k]}</span>
              <span className="font-mono min-w-[2ch] inline-block text-center">
                {vals[k] || '_'}
              </span>
            </button>
          ))}
        </div>

        <div
          className="grid grid-cols-3 gap-2 text-lg font-mono select-none"
          data-testid="keypad"
        >
          {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => append(d)}
              className="bg-white border border-neutral-300 rounded py-2 hover:bg-neutral-50"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={backspace}
            className="bg-white border border-neutral-300 rounded py-2 hover:bg-neutral-50 text-sm"
            aria-label="一文字削除"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={() => append('0')}
            className="bg-white border border-neutral-300 rounded py-2 hover:bg-neutral-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={submit}
            className="bg-ink text-paper border border-ink rounded py-2 hover:opacity-90 text-sm"
          >
            移動
          </button>
        </div>

        <div className="flex gap-2 text-xs justify-between">
          <button
            type="button"
            onClick={() => focusNext('of')}
            className="px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
            title="/  でフォーカス"
          >
            / の
          </button>
          <button
            type="button"
            onClick={() => focusNext('paragraph')}
            className="px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
            title="*  でフォーカス"
          >
            * 項
          </button>
          <button
            type="button"
            onClick={() => focusNext('item')}
            className="px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
            title="-  でフォーカス"
          >
            - 号
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 ml-auto"
          >
            Esc
          </button>
        </div>
      </div>
    </div>
  );
}
