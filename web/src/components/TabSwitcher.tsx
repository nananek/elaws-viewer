import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTabs } from '../state/tabs.js';

interface Props {
  /** lawId of the law currently shown — highlighted and labels the button. */
  currentLawId: string;
}

/**
 * Tab switcher button + dropdown for the LawViewer toolbar.
 *
 * The top-of-page LawTabs strip lives in normal document flow and scrolls
 * out of view as you read down a long law — on a phone you'd have to
 * scroll all the way back to the top of 第一条 to switch laws. This button
 * sits in the viewer's `sticky top-0` toolbar, so it (and the open-tab
 * list it reveals) stays reachable at any scroll position. Tabs don't need
 * to be permanently visible — a tap to reveal them is enough.
 */
export function TabSwitcher({ currentLawId }: Props) {
  const tabs = useTabs((s) => s.tabs);
  const close = useTabs((s) => s.close);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (tabs.length === 0) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm px-3 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
        title="開いている法令を切り替え"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="tab-switcher-button"
      >
        ⊞ タブ ({tabs.length})
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 w-72 max-w-[90vw] max-h-[60vh] overflow-y-auto rounded-md border border-neutral-300 bg-paper shadow-xl py-1"
          data-testid="tab-switcher-menu"
        >
          {tabs.map((t) => {
            const active = t.lawId === currentLawId;
            return (
              <div
                key={t.lawId}
                data-tab-switcher-law-id={t.lawId}
                data-active={active ? '1' : '0'}
                className={`flex items-center gap-1 pl-3 pr-1 ${
                  active ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                }`}
              >
                <Link
                  to="/law/$lawId"
                  params={{ lawId: t.lawId }}
                  className="flex-1 truncate py-2 text-sm"
                  title={t.title}
                  onClick={() => setOpen(false)}
                >
                  {active && <span className="text-neutral-400 mr-1">▸</span>}
                  {t.title}
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    close(t.lawId);
                    if (active) {
                      // Jump to the next remaining tab, or home.
                      const remaining = useTabs.getState().tabs;
                      if (remaining.length > 0) {
                        void navigate({
                          to: '/law/$lawId',
                          params: {
                            lawId: remaining[remaining.length - 1]!.lawId,
                          },
                        });
                      } else {
                        void navigate({ to: '/' });
                      }
                      setOpen(false);
                    }
                  }}
                  className="inline-flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 w-11 h-11 text-lg shrink-0"
                  aria-label={`タブを閉じる: ${t.title}`}
                  title="閉じる"
                  data-tab-switcher-close
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
