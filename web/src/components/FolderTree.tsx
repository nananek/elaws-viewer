import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DownloadedLaw } from '@elaws/shared/types';
import {
  type Folder,
  createFolderApi,
  deleteFolderApi,
  renameFolderApi,
  setLawFolderApi,
} from '../api/folders.js';
import { deleteLaw } from '../api/laws.js';

interface Props {
  folders: Folder[];
  laws: DownloadedLaw[];
}

interface FolderNode {
  folder: Folder | null; // null for the synthetic root "/" bucket
  children: FolderNode[];
  laws: DownloadedLaw[];
}

const ROOT_PATH = '/';
const UNCATEGORIZED_PATH = '__uncategorized__';

function buildTree(folders: Folder[], laws: DownloadedLaw[]): FolderNode {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parentUuid ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ja'));
  }

  const byPath = new Map<string, DownloadedLaw[]>();
  for (const law of laws) {
    const p = law.filepath || ROOT_PATH;
    if (!byPath.has(p)) byPath.set(p, []);
    byPath.get(p)!.push(law);
  }
  for (const arr of byPath.values()) {
    arr.sort((a, b) => a.lawTitle.localeCompare(b.lawTitle, 'ja'));
  }

  // Track which filepaths the folder tree actually covers; any law whose
  // filepath is not in this set is an "orphan" — surfaced under a single
  // 未分類 bucket so the user can still find every downloaded law. This
  // happens with Catalystwo imports where a DownloadedLaw can itself act
  // as a folder container (e.g. マイ六法/商法/保険法).
  const coveredPaths = new Set<string>([ROOT_PATH]);

  function makeNode(folder: Folder | null): FolderNode {
    const path = folder?.path ?? ROOT_PATH;
    coveredPaths.add(path);
    const childFolders = byParent.get(folder?.uuid ?? null) ?? [];
    return {
      folder,
      children: childFolders.map(makeNode),
      laws: byPath.get(path) ?? [],
    };
  }

  const tree = makeNode(null);

  // Collect orphans (laws whose filepath was not visited by makeNode).
  const orphans: DownloadedLaw[] = [];
  for (const [p, arr] of byPath) {
    if (!coveredPaths.has(p)) orphans.push(...arr);
  }
  if (orphans.length > 0) {
    orphans.sort((a, b) => a.lawTitle.localeCompare(b.lawTitle, 'ja'));
    tree.children.push({
      folder: {
        uuid: UNCATEGORIZED_PATH,
        title: '未分類',
        parentUuid: null,
        order: Number.MAX_SAFE_INTEGER,
        path: UNCATEGORIZED_PATH,
        createdAt: '',
        updatedAt: '',
      },
      children: [],
      laws: orphans,
    });
  }
  return tree;
}

export function FolderTree({ folders, laws }: Props) {
  const queryClient = useQueryClient();
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  const root = useMemo(() => buildTree(folders, laws), [folders, laws]);

  const createMut = useMutation({
    mutationFn: (input: { title: string; parentUuid: string | null }) =>
      createFolderApi(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  });
  const renameMut = useMutation({
    mutationFn: ({ uuid, title }: { uuid: string; title: string }) =>
      renameFolderApi(uuid, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  });
  const deleteMut = useMutation({
    mutationFn: deleteFolderApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  });
  const moveMut = useMutation({
    mutationFn: ({ filename, path }: { filename: string; path: string }) =>
      setLawFolderApi(filename, path),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['laws'] }),
  });
  const deleteLawMut = useMutation({
    mutationFn: (filename: string) => deleteLaw(filename),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['laws'] }),
  });

  function onDropLaw(targetPath: string, e: React.DragEvent) {
    e.preventDefault();
    const filename = e.dataTransfer.getData('application/x-law-filename');
    if (!filename) return;
    moveMut.mutate({ filename, path: targetPath });
    setDropTargetPath(null);
  }

  function renderNode(node: FolderNode, depth: number) {
    const path = node.folder?.path ?? ROOT_PATH;
    const isSynthetic = node.folder?.uuid === UNCATEGORIZED_PATH;
    const indent = { paddingLeft: `${depth * 1}rem` };
    const isDropTarget = dropTargetPath === path;
    return (
      <div key={path} style={indent}>
        <div
          className={`flex items-baseline gap-2 px-1 py-1 rounded ${
            isDropTarget ? 'bg-yellow-50 outline outline-1 outline-yellow-300' : ''
          }`}
          onDragOver={(e) => {
            if (isSynthetic) return; // synthetic 未分類 isn't a real drop target
            if (!e.dataTransfer.types.includes('application/x-law-filename'))
              return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropTargetPath(path);
          }}
          onDragLeave={() => {
            if (dropTargetPath === path) setDropTargetPath(null);
          }}
          onDrop={(e) => { if (!isSynthetic) onDropLaw(path, e); }}
        >
          {renameTarget === node.folder?.uuid ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                renameMut.mutate({
                  uuid: node.folder!.uuid,
                  title: renameValue,
                });
                setRenameTarget(null);
              }}
              className="flex gap-1"
            >
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="text-sm px-1 border border-neutral-300 rounded"
              />
              <button type="submit" className="text-xs text-ink underline">
                保存
              </button>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="text-xs text-neutral-500 underline"
              >
                取消
              </button>
            </form>
          ) : (
            <>
              <span className="heading-gothic text-sm font-semibold">
                {isSynthetic
                  ? `📦 ${node.folder!.title}`
                  : node.folder
                    ? `📁 ${node.folder.title}`
                    : '🏠 ルート'}
              </span>
              {!isSynthetic && (
                <button
                  type="button"
                  onClick={() =>
                    createMut.mutate({
                      title: '新規フォルダ',
                      parentUuid: node.folder?.uuid ?? null,
                    })
                  }
                  className="text-xs text-neutral-500 underline hover:text-ink"
                  title="子フォルダを追加"
                >
                  + 子
                </button>
              )}
              {node.folder && !isSynthetic && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameTarget(node.folder!.uuid);
                      setRenameValue(node.folder!.title);
                    }}
                    className="text-xs text-neutral-500 underline hover:text-ink"
                  >
                    名前変更
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`フォルダ「${node.folder!.title}」を削除しますか?`))
                        return;
                      deleteMut.mutate(node.folder!.uuid);
                    }}
                    className="text-xs text-red-600 underline hover:text-red-800"
                  >
                    削除
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <ul className="ml-4">
          {node.laws.map((law) => (
            <li
              key={law.uuid}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/x-law-filename', law.filename);
              }}
              data-testid="folder-tree-law"
              className="px-1 cursor-grab active:cursor-grabbing group"
            >
              <div className="flex items-baseline gap-2">
                <Link
                  to="/law/$lawId"
                  params={{ lawId: law.filename }}
                  draggable={false}
                  className="block flex-1 min-w-0 px-2 py-1 rounded hover:bg-neutral-100 text-sm"
                >
                  <div className="flex justify-between gap-3 items-baseline">
                    <span className="truncate">{law.lawTitle}</span>
                    <span className="text-xs text-neutral-500 truncate">
                      {law.lawNum}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !confirm(`「${law.lawTitle}」を削除しますか?\n(ハイライト等は保持されます)`)
                    ) {
                      return;
                    }
                    deleteLawMut.mutate(law.filename);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-red-600 underline hover:text-red-800 px-1"
                  title="この法令をフォルダから削除"
                  data-testid="folder-tree-law-delete"
                  aria-label={`${law.lawTitle} を削除`}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="folder-tree">
      {renderNode(root, 0)}
    </div>
  );
}
