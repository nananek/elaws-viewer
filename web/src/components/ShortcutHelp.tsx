import { useEffect, useState } from 'react';

const SHORTCUTS: Array<{ keys: string; what: string }> = [
  { keys: 'g /',        what: 'このヘルプを開く / 閉じる' },
  { keys: '?',          what: '法令名検索モーダルを開く (タブ / 既DL / e-Gov)' },
  { keys: '/',          what: '法令ビューア: 表示中の法令の中をテキスト検索 (カード結果)' },
  { keys: '=',          what: '法令ビューア: 条文番号ジャンプ (テンキー UI)' },
  { keys: '0–9 . +',    what: 'ジャンプモーダル: 数字追記 / 次フィールドへ' },
  { keys: 'j / k',      what: '法令ビューア: 次/前の最小単位 (条→項→号) にフォーカス移動' },
  { keys: 'f / b',      what: '法令ビューア: 1ページ送り / 戻し (フォーカスはページ端に追従)' },
  { keys: 'Enter',      what: 'ジャンプモーダル / 検索モーダルで決定' },
  { keys: 'Esc',        what: 'モーダル / 入力欄を閉じる' },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  // Trigger: `g` followed by `/` within 1 second (vim-style chord).
  // The chord listener runs in CAPTURE phase and stops propagation on
  // success so other `/` listeners (in-law search etc.) don't also fire.
  useEffect(() => {
    let gPressedAt = 0;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inField =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable);
      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'g') {
        gPressedAt = Date.now();
        return;
      }
      if (e.key === '/' && Date.now() - gPressedAt < 1000) {
        e.preventDefault();
        e.stopPropagation();
        gPressedAt = 0;
        setOpen((v) => !v);
        return;
      }
      // Any other key resets the chord state
      gPressedAt = 0;
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions);
  }, [open]);

  return (
    <>
      {/* Always-visible "?" button so help is reachable even without a chord. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-3 right-3 z-40 w-7 h-7 rounded-full bg-paper border border-neutral-300 text-sm text-neutral-500 hover:text-ink hover:border-ink shadow"
        aria-label="キーボードショートカット (g / で開閉)"
        title="キーボードショートカット (g / で開閉)"
        data-testid="shortcut-help-button"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
          data-testid="shortcut-help-modal"
        >
          <div
            className="bg-paper text-ink rounded-lg shadow-xl p-5 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="heading-gothic text-lg font-bold">
                キーボードショートカット
              </h2>
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
      )}
    </>
  );
}
