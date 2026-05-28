import { useEffect, useState } from 'react';

const SHORTCUTS: Array<{ keys: string; what: string }> = [
  { keys: '?',          what: 'このヘルプを開く / 閉じる' },
  { keys: '/',          what: '法令名検索モーダルを開く (タブ / 既DL / e-Gov)' },
  { keys: '=',          what: '法令ビューア: 条文番号ジャンプ (テンキー UI)' },
  { keys: '0–9',        what: 'ジャンプモーダル: アクティブフィールドに数字追記' },
  { keys: '/ * - +',    what: 'ジャンプモーダル: 条→の→項→号 にフォーカス移動' },
  { keys: 'Enter',      what: 'ジャンプモーダル / 検索モーダルで決定' },
  { keys: 'Esc',        what: 'モーダル / 入力欄を閉じる' },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inField =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable);
      if (e.key === '?' && !inField && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-paper text-ink rounded-lg shadow-xl p-5 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="heading-gothic text-lg font-bold">キーボードショートカット</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-neutral-500 hover:text-ink"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys} className="border-t border-neutral-200 first:border-t-0">
                <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">
                  {s.keys}
                </td>
                <td className="py-1.5">{s.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
