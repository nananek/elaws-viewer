import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchTags, updateTagTitle } from '../api/tags.js';
import { STYLE_MAP } from '@elaws/shared/styles';

const COLOR_BY_TYPE: Record<number, string> = {
  0: STYLE_MAP[0]!.hex,
  1: STYLE_MAP[1]!.hex,
  2: STYLE_MAP[2]!.hex,
  3: STYLE_MAP[3]!.hex,
  4: STYLE_MAP[4]!.hex,
  5: STYLE_MAP[11]!.hex, // orange
  6: '#9aa0a6',
  7: '#b4b2af',
};

export function TagsPage() {
  const queryClient = useQueryClient();
  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: () => fetchTags() });
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const updateMutation = useMutation({
    mutationFn: ({ tagNumber, title }: { tagNumber: number; title: string }) =>
      updateTagTitle(tagNumber, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
      setEditing(null);
      setDraft('');
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">タグ</h1>
      <p className="text-sm text-neutral-500 mb-4">
        タグは条文の anchor に種類だけ付ける機能（マーカーとは別）。8 つ固定。
      </p>
      <ul className="space-y-2">
        {tagsQ.data?.tagEntities.map((t) => (
          <li
            key={t.tagNumber}
            className="flex items-center gap-3 border border-neutral-200 dark:border-neutral-800 rounded p-2"
          >
            <span
              className="w-5 h-5 rounded-full shrink-0"
              style={{ background: COLOR_BY_TYPE[t.colorType] ?? '#888' }}
              title={`colorType=${t.colorType}`}
            />
            <span className="text-xs text-neutral-500 w-12">#{t.tagNumber}</span>
            {editing === t.tagNumber ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => updateMutation.mutate({ tagNumber: t.tagNumber, title: draft })}
                  className="text-sm px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(null); setDraft(''); }}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  取消
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{t.title}</span>
                <button
                  type="button"
                  onClick={() => { setEditing(t.tagNumber); setDraft(t.title); }}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  名前変更
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
