import { useRef, useState } from 'react';

interface CountBucket {
  created?: number;
  updated: number;
  skipped?: number;
}

interface MergeStats {
  selections: CountBucket;
  bookmarks: CountBucket;
  tags: CountBucket;
  tagEntities: { updated: number };
  downloads: CountBucket;
  organizables: CountBucket;
  errors: string[];
}

const ROW_LABELS: Array<{ key: keyof MergeStats; label: string }> = [
  { key: 'selections', label: 'SelectionObject' },
  { key: 'bookmarks', label: 'Bookmark' },
  { key: 'tags', label: 'Tag' },
  { key: 'tagEntities', label: 'TagEntity' },
  { key: 'downloads', label: 'DownloadedLaw' },
  { key: 'organizables', label: 'Organizable' },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatRow(bucket: CountBucket | { updated: number }): string {
  if (!('created' in bucket)) {
    return `更新 ${bucket.updated}`;
  }
  const b = bucket as CountBucket;
  return `新規 ${b.created ?? 0} / 更新 ${b.updated} / スキップ ${b.skipped ?? 0}`;
}

export function SettingsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<MergeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function runImport() {
    if (!selectedFile) return;
    setImporting(true);
    setStats(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      const res = await fetch('/api/import/realm', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? JSON.stringify(data));
      setStats(data.stats as MergeStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="heading-gothic text-2xl font-bold">設定 / Import-Export</h1>

      <section className="border border-neutral-200 rounded p-4">
        <h2 className="heading-gothic text-lg font-semibold mb-2">エクスポート</h2>
        <p className="text-sm text-neutral-600 mb-3">
          現在のハイライト・ブックマーク・タグ等を <code>.realm</code>{' '}
          ファイルとしてダウンロードします。iOS アプリにそのまま取り込めます。
        </p>
        <a
          href="/api/export/realm"
          className="inline-block px-4 py-2 rounded bg-ink text-paper text-sm hover:opacity-90"
        >
          annotations.realm をダウンロード
        </a>
      </section>

      <section className="border border-neutral-200 rounded p-4">
        <h2 className="heading-gothic text-lg font-semibold mb-2">インポート</h2>
        <p className="text-sm text-neutral-600 mb-3">
          アップロードした <code>.realm</code> の SelectionObject / Bookmark / Tag
          / Organizable / DownloadedLaw を uuid 一致でマージし、{' '}
          <code>updatedAt</code> の新しい方を優先します。既存データは上書きされず、
          新しい行のみが取り込まれます。
        </p>

        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setSelectedFile(f);
            setStats(null);
            setError(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 rounded border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-50"
          >
            ファイルを選ぶ
          </button>
          <button
            type="button"
            onClick={runImport}
            disabled={!selectedFile || importing}
            className="px-4 py-2 rounded bg-ink text-paper text-sm hover:opacity-90 disabled:opacity-40"
          >
            {importing ? 'マージ中…' : 'インポート実行'}
          </button>
          {selectedFile && (
            <span className="text-sm text-neutral-600" data-testid="selected-file">
              {selectedFile.name}{' '}
              <span className="text-neutral-400">({formatBytes(selectedFile.size)})</span>
            </span>
          )}
        </div>

        {importing && (
          <p className="text-sm mt-3 text-neutral-600" role="status">
            <span
              aria-hidden
              className="inline-block w-3 h-3 mr-2 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin align-middle"
            />
            マージ中… 大きい Realm では数秒〜数十秒かかります。
          </p>
        )}

        {error && (
          <div
            className="mt-3 border border-red-300 bg-red-50 text-red-700 text-sm rounded p-2"
            role="alert"
          >
            {error}
          </div>
        )}

        {stats && (
          <div className="mt-4" data-testid="merge-result">
            <h3 className="heading-gothic text-sm font-semibold mb-2">マージ結果</h3>
            <dl className="text-sm font-mono grid grid-cols-[12rem_1fr] gap-y-1">
              {ROW_LABELS.map((row) => (
                <div key={row.key} className="contents">
                  <dt className="text-neutral-600">{row.label}</dt>
                  <dd>{formatRow(stats[row.key] as CountBucket)}</dd>
                </div>
              ))}
            </dl>
            {stats.errors.length > 0 && (
              <div
                className="mt-3 border border-red-300 bg-red-50 text-red-700 text-sm rounded p-2"
                role="alert"
              >
                <p className="font-semibold mb-1">エラー {stats.errors.length} 件</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {stats.errors.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
