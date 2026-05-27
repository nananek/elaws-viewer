import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { useTabs } from '../state/tabs.js';

export function LawTabs() {
  const tabs = useTabs((s) => s.tabs);
  const close = useTabs((s) => s.close);
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();

  if (tabs.length === 0) return null;

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-2 py-1 flex flex-wrap gap-1 text-sm">
      {tabs.map((t) => {
        const active = matchRoute({ to: '/law/$lawId', params: { lawId: t.lawId } });
        return (
          <div
            key={t.lawId}
            className={`flex items-center gap-1 px-2 py-1 rounded ${
              active
                ? 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
            }`}
          >
            <Link
              to="/law/$lawId"
              params={{ lawId: t.lawId }}
              className="truncate max-w-[16rem]"
              title={t.title}
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
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 px-1"
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
