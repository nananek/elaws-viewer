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

const rootRoute = createRootRoute({
  component: function RootLayout() {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center gap-4">
          <Link
            to="/"
            className="font-bold text-neutral-900 dark:text-neutral-100 hover:underline"
          >
            elaws-viewer
          </Link>
          <nav className="text-sm text-neutral-600 dark:text-neutral-400 flex gap-3">
            <Link to="/" className="hover:underline">法令一覧</Link>
          </nav>
        </header>
        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
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
});

const routeTree = rootRoute.addChildren([homeRoute, lawRoute]);

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
