import { useEffect, useState } from 'react';
import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  RouterProvider,
} from '@tanstack/react-router';
import { HomePage } from './routes/Home.js';
import { LawPage } from './routes/Law.js';
import { SearchPage } from './routes/Search.js';
import { BookmarksPage } from './routes/Bookmarks.js';
import { TagsPage } from './routes/Tags.js';
import { SettingsPage } from './routes/Settings.js';
import { LawTabs } from './components/LawTabs.js';
import { ShortcutHelp } from './components/ShortcutHelp.js';
import { UpdateBanner } from './components/UpdateBanner.js';
import { GlobalLawSearchModal } from './components/GlobalLawSearchModal.js';
import { AddLawModal } from './components/AddLawModal.js';

const rootRoute = createRootRoute({
  component: function RootLayout() {
    const [searchOpen, setSearchOpen] = useState(false);
    const [addOpen, setAddOpen] = useState<{ initialQuery: string } | null>(null);

    // `?` opens the global law-name search modal when no input is focused.
    // (Was `/` before — that key is now in-law text search inside LawViewer.
    // The shortcut-help modal moved to the `g/` chord — see ShortcutHelp.)
    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.defaultPrevented) return; // chord listener (g/) may have eaten this
        const t = e.target as HTMLElement | null;
        const inField =
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable);
        if (e.key === '?' && !inField) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
      // Fixed-height app shell: the window itself never scrolls (overflow
      // -hidden + h-screen). Only `main` scrolls. This is what keeps the
      // header + tab strip pinned: previously the column was `min-h-screen`
      // and the law viewer's `h-[calc(100vh-3rem)]` ignored the tab bar's
      // height, so the body grew past the viewport and the WINDOW gained a
      // scrollbar. A 条文ジャンプ (scrollIntoView) then scrolled that window,
      // sliding the chrome off-screen — manual inner-scroll didn't, which
      // is why only jumps lost the tabs. With a fixed shell, scrollIntoView
      // can only move the inner scroll region.
      <div className="h-screen flex flex-col overflow-hidden">
        <UpdateBanner />
        <header className="shrink-0 border-b border-neutral-200 px-4 py-2 flex items-center gap-4">
          <Link
            to="/"
            className="heading-gothic font-bold text-ink hover:underline"
          >
            elaws-viewer
          </Link>
          <nav className="heading-gothic text-sm text-neutral-600 flex gap-3">
            <Link to="/" className="hover:underline">法令一覧</Link>
            <Link to="/settings" className="hover:underline">設定</Link>
          </nav>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto text-xs text-neutral-500 hover:text-ink border border-neutral-200 rounded px-2 py-0.5"
            title="法令名検索 ( ? )"
          >
            ? 検索
          </button>
        </header>
        <LawTabs />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
        <ShortcutHelp />
        {searchOpen && (
          <GlobalLawSearchModal
            onClose={() => setSearchOpen(false)}
            onRemoteHit={(_lawId, title) => setAddOpen({ initialQuery: title })}
          />
        )}
        {addOpen && (
          <AddLawModal
            onClose={() => setAddOpen(null)}
            initialQuery={addOpen.initialQuery}
          />
        )}
      </div>
    );
  },
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const lawRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/law/$lawId',
  component: LawPage,
  validateSearch: (search): { at?: string } => ({
    at: typeof search.at === 'string' ? search.at : undefined,
  }),
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchPage,
});

const bookmarksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bookmarks',
  component: BookmarksPage,
});

const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tags',
  component: TagsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute, lawRoute, searchRoute, bookmarksRoute, tagsRoute, settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
