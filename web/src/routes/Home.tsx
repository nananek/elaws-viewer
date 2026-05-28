import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchLaws } from '../api/laws.js';

export function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['laws'],
    queryFn: fetchLaws,
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="heading-gothic text-2xl font-bold mb-4">ダウンロード済み法令</h1>

      {isLoading && <p className="text-sm">読み込み中…</p>}
      {error && (
        <p className="text-sm text-red-600">エラー: {String(error)}</p>
      )}

      {data && (
        <>
          <p className="text-sm text-neutral-600 mb-4">
            {data.count} 件
          </p>
          <ul className="space-y-1">
            {data.laws.map((law) => (
              <li key={law.uuid}>
                <Link
                  to="/law/$lawId"
                  params={{ lawId: law.filename }}
                  className="block px-3 py-2 rounded hover:bg-neutral-100"
                >
                  <div className="flex justify-between gap-4 items-baseline">
                    <span className="font-medium">{law.lawTitle}</span>
                    <span className="text-xs text-neutral-500 truncate">
                      {law.lawNum}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400">
                    {law.filename}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
