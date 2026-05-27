import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { searchGlobal } from '../api/search.js';
import { fetchLaws } from '../api/laws.js';

export function SearchPage() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const lawsQ = useQuery({ queryKey: ['laws'], queryFn: fetchLaws });

  const lawIdByLawNum = new Map<string, string>();
  for (const l of lawsQ.data?.laws ?? []) {
    lawIdByLawNum.set(l.lawNum, l.filename);
  }

  const search = useQuery({
    queryKey: ['search', 'global', debounced],
    queryFn: () => searchGlobal(debounced),
    enabled: debounced.length >= 2,
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">横断検索</h1>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="キーワード (2文字以上)…"
        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded mb-3 bg-white dark:bg-neutral-900"
      />
      {search.isFetching && <p className="text-sm text-neutral-500">検索中…</p>}
      {search.data && (
        <>
          <p className="text-sm text-neutral-500 mb-2">
            {search.data.count} 件
          </p>
          <ul className="space-y-2">
            {search.data.hits.map((h, i) => {
              // Search returns lawId already; if not match, fall back to lawTitle
              const targetLawId = h.lawId;
              return (
                <li key={`${h.lawId}-${i}`} className="border border-neutral-200 dark:border-neutral-800 rounded p-3">
                  <Link
                    to="/law/$lawId"
                    params={{ lawId: targetLawId }}
                    search={{ at: h.anchor }}
                    className="block hover:underline"
                  >
                    <div className="text-xs text-neutral-500 mb-1">
                      {h.lawTitle} · {h.anchor}
                    </div>
                    <div
                      className="text-sm leading-relaxed"
                      // FTS snippet returns <mark> already
                      dangerouslySetInnerHTML={{ __html: h.snippet }}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
