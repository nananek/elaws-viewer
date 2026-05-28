import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { deleteBookmark, fetchBookmarks } from '../api/bookmarks.js';
import { fetchLaws } from '../api/laws.js';

export function BookmarksPage() {
  const queryClient = useQueryClient();
  const bookmarksQ = useQuery({ queryKey: ['bookmarks'], queryFn: () => fetchBookmarks() });
  const lawsQ = useQuery({ queryKey: ['laws'], queryFn: fetchLaws });

  const delMutation = useMutation({
    mutationFn: deleteBookmark,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  const lawIdByLawNum = new Map<string, { lawId: string; lawTitle: string }>();
  for (const l of lawsQ.data?.laws ?? []) {
    lawIdByLawNum.set(l.lawNum, { lawId: l.filename, lawTitle: l.lawTitle });
  }

  // group by lawNo
  const groups = new Map<string, ReturnType<typeof Object>>();
  for (const b of bookmarksQ.data?.bookmarks ?? []) {
    const arr = (groups.get(b.lawNo) as any[]) ?? [];
    arr.push(b);
    groups.set(b.lawNo, arr as any);
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="heading-gothic text-2xl font-bold mb-4">ブックマーク</h1>
      {bookmarksQ.isLoading && <p className="text-sm">読み込み中…</p>}
      {bookmarksQ.data && bookmarksQ.data.count === 0 && (
        <p className="text-sm text-neutral-500">まだブックマークがありません。法令ビューアの右下のボタンから追加できます。</p>
      )}
      {Array.from(groups).map(([lawNo, items]) => {
        const law = lawIdByLawNum.get(lawNo);
        const arr = items as any[];
        return (
          <section key={lawNo} className="mb-6">
            <h2 className="heading-gothic font-semibold mb-2">{law?.lawTitle ?? lawNo}</h2>
            <ul className="space-y-1">
              {arr.map((b) => (
                <li key={b.uuid} className="flex items-center gap-2">
                  {law ? (
                    <Link
                      to="/law/$lawId"
                      params={{ lawId: law.lawId }}
                      search={{ at: b.anchor }}
                      className="flex-1 px-2 py-1 rounded hover:bg-neutral-100"
                    >
                      <span className="text-xs text-neutral-500 mr-2">{b.anchor}</span>
                      <span>{b.title}</span>
                      {b.notes && <span className="ml-2 text-xs text-neutral-400">— {b.notes}</span>}
                    </Link>
                  ) : (
                    <span className="flex-1 text-neutral-400 text-sm">{b.anchor} {b.title}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => delMutation.mutate(b.uuid)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
