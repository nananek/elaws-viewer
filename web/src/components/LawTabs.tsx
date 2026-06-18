import { useState } from 'react';
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { useTabs } from '../state/tabs.js';

export function LawTabs() {
  const tabs = useTabs((s) => s.tabs);
  const close = useTabs((s) => s.close);
  const move = useTabs((s) => s.move);
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const [dragLawId, setDragLawId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (tabs.length === 0) return null;

  return (
    // Single-row, horizontally-scrollable strip. Previously `flex-wrap`
    // let tabs pile up into multiple rows that grew downward — with no
    // scroll/overflow affordance, on narrow screens (mobile PWA, iPad)
    // the extra rows pushed the viewer down and tabs ended up off-screen
    // with no way to reach them. `overflow-x-auto` keeps the bar one row
    // tall and swipe/scroll-reachable on touch; each tab is `shrink-0`
    // so labels stay readable instead of being squeezed to nothing.
    <div
      data-testid="law-tabs"
      className="heading-gothic shrink-0 border-b border-neutral-200 bg-paper px-2 py-1 flex flex-nowrap overflow-x-auto gap-1 text-sm"
    >
      {tabs.map((t, i) => {
        const active = matchRoute({ to: '/law/$lawId', params: { lawId: t.lawId } });
        const isDragging = dragLawId === t.lawId;
        const dropBefore = dropIndex === i && dragLawId !== null && dragLawId !== t.lawId;
        const dropAfter =
          dropIndex === i + 1 && dragLawId !== null && dragLawId !== t.lawId;
        return (
          <div
            key={t.lawId}
            draggable
            onDragStart={(e) => {
              setDragLawId(t.lawId);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', t.lawId);
            }}
            onDragOver={(e) => {
              if (dragLawId === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const rect = e.currentTarget.getBoundingClientRect();
              const before = e.clientX < rect.left + rect.width / 2;
              setDropIndex(before ? i : i + 1);
            }}
            onDragLeave={() => {
              // only clear if we leave this specific element; the next dragOver fixes it
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragLawId === null) return;
              const from = tabs.findIndex((x) => x.lawId === dragLawId);
              let to = dropIndex ?? i;
              if (from !== -1 && from < to) to -= 1;
              move(dragLawId, to);
              setDragLawId(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              setDragLawId(null);
              setDropIndex(null);
            }}
            data-tab-law-id={t.lawId}
            data-active={active ? '1' : '0'}
            className={`group relative flex shrink-0 items-center gap-1 pl-2 pr-1 py-1 rounded ${
              active
                ? 'bg-white border border-neutral-300'
                : 'hover:bg-neutral-100'
            } ${isDragging ? 'opacity-40' : ''}`}
          >
            {dropBefore && (
              <span
                aria-hidden
                className="absolute -left-0.5 top-1 bottom-1 w-0.5 bg-ink rounded"
              />
            )}
            {dropAfter && (
              <span
                aria-hidden
                className="absolute -right-0.5 top-1 bottom-1 w-0.5 bg-ink rounded"
              />
            )}
            <Link
              to="/law/$lawId"
              params={{ lawId: t.lawId }}
              className="truncate max-w-[16rem]"
              title={t.title}
              draggable={false}
            >
              {t.title}
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                close(t.lawId);
                if (active) {
                  // jump to the next remaining tab, or home
                  const remaining = useTabs.getState().tabs;
                  if (remaining.length > 0) {
                    void navigate({
                      to: '/law/$lawId',
                      params: { lawId: remaining[remaining.length - 1]!.lawId },
                    });
                  } else {
                    void navigate({ to: '/' });
                  }
                }
              }}
              // Visibility model — protect iPad users from accidentally
              // closing the wrong tab while trying to switch:
              //   * active tab: × always visible (so you can close the
              //     current tab without first leaving it).
              //   * non-active tab: invisible (NOT display:none) by
              //     default so the tab's width is stable; on hover-
              //     capable mouse devices we flip visibility on group
              //     hover (Chrome / Safari tab-bar convention). On
              //     touch we never reveal it — you must switch to the
              //     tab first, then close.
              //
              // Using `invisible` instead of `hidden` reserves the
              // layout slot so the tab doesn't flicker-resize when
              // the mouse enters/leaves.
              //
              // Size: ≥ 44 × 44 hit area on coarse pointer (iPad);
              // smaller on mouse since precision is fine.
              data-tab-close
              className={
                'inline-flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 ' +
                'w-6 h-6 text-base pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:text-xl ' +
                (active
                  ? 'visible'
                  : 'invisible pointer-fine:group-hover:visible')
              }
              aria-label={`Close tab ${t.title}`}
              title="閉じる"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
