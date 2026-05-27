import { useState } from 'react';

export function SettingsPage() {
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(file: File) {
    setImporting(true);
    setStats(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import/realm', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setStats(data.stats);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">設定 / Import-Export</h1>

      <section className="border border-neutral-200 dark:border-neutral-800 rounded p-4">
        <h2 className="text-lg font-semibold mb-2">エクスポート</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          現在のハイライト・ブックマーク・タグ等を `.realm` ファイルとして
          ダウンロードします。iOS アプリにそのまま取り込めます。
        </p>
        <a
          href="/api/export/realm"
          className="inline-block px-4 py-2 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-sm hover:opacity-90"
        >
          annotations.realm をダウンロード
        </a>
      </section>

      <section className="border border-neutral-200 dark:border-neutral-800 rounded p-4">
        <h2 className="text-lg font-semibold mb-2">インポート</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          iOS アプリ等からエクスポートした `.realm` (拡張子問わず) を
          アップロードして uuid マージ。`updatedAt` が新しい方が優先されます。
        </p>
        <input
          type="file"
          onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          className="text-sm"
          disabled={importing}
        />
        {importing && <p className="text-sm mt-2">マージ中…</p>}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {stats != null && (
          <pre className="text-xs mt-3 p-2 bg-neutral-50 dark:bg-neutral-900 rounded overflow-x-auto">
            {JSON.stringify(stats, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
