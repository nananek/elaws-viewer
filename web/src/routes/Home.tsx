import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLaws } from '../api/laws.js';
import { fetchFolders } from '../api/folders.js';
import { FolderTree } from '../components/FolderTree.js';
import { AddLawModal } from '../components/AddLawModal.js';

export function HomePage() {
  const lawsQuery = useQuery({ queryKey: ['laws'], queryFn: fetchLaws });
  const foldersQuery = useQuery({
    queryKey: ['folders'],
    queryFn: fetchFolders,
  });
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-baseline gap-4 mb-4">
        <h1 className="heading-gothic text-2xl font-bold">ダウンロード済み法令</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="ml-auto text-sm px-3 py-1.5 rounded bg-ink text-paper hover:opacity-90"
          data-testid="add-law-button"
        >
          + 法令を追加
        </button>
      </div>

      {(lawsQuery.isLoading || foldersQuery.isLoading) && (
        <p className="text-sm">読み込み中…</p>
      )}
      {lawsQuery.error && (
        <p className="text-sm text-red-600">
          エラー: {String(lawsQuery.error)}
        </p>
      )}

      {lawsQuery.data && foldersQuery.data && (
        <>
          <p className="text-sm text-neutral-600 mb-4">
            {lawsQuery.data.count} 件 / {foldersQuery.data.count} フォルダ
          </p>
          <FolderTree
            folders={foldersQuery.data.folders}
            laws={lawsQuery.data.laws}
          />
        </>
      )}

      {addOpen && <AddLawModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}
