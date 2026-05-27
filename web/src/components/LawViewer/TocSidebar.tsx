interface TocEntry {
  anchor: string;
  text: string;
  level: 'part' | 'chapter' | 'section' | 'subsection' | 'article';
}

interface Props {
  toc: TocEntry[];
  onJump: (anchor: string) => void;
}

const INDENT: Record<TocEntry['level'], string> = {
  part: 'pl-0 font-semibold text-neutral-900 dark:text-neutral-100 mt-3',
  chapter: 'pl-2 font-medium',
  section: 'pl-4',
  subsection: 'pl-6 text-sm',
  article: 'pl-8 text-xs text-neutral-600 dark:text-neutral-400',
};

export function TocSidebar({ toc, onJump }: Props) {
  return (
    <nav className="text-sm">
      <h2 className="text-xs uppercase text-neutral-500 mb-2">目次</h2>
      <ul>
        {toc.map((e, i) => (
          <li key={`${e.anchor}-${i}`} className={INDENT[e.level]}>
            <button
              type="button"
              onClick={() => onJump(e.anchor)}
              className="w-full text-left py-1 hover:underline truncate"
              title={e.text}
            >
              {e.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
