import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.js';
import { startTabsSync } from './state/tabs.js';
import { registerChangeFeedInvalidations } from './api/changeFeedBridge.js';
import './styles/global.css';

// NOTE: StrictMode is intentionally disabled. The LawViewer applies
// non-React DOM mutations (highlight overlays) which break under
// StrictMode's double-invocation.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

startTabsSync();
registerChangeFeedInvalidations(queryClient);

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
