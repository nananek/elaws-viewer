import { useQuery } from '@tanstack/react-query';

interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  time: string;
}

export function App() {
  const { data, isLoading, error } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">elaws-viewer</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        Phase 0: scaffold sanity check.
      </p>

      <section className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">/api/health</h2>
        {isLoading && <p className="text-sm">Loading…</p>}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Error: {String(error)}
          </p>
        )}
        {data && (
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
