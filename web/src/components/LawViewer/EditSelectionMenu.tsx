import { STYLE_MAP } from '@elaws/shared/styles';

interface Props {
  x: number;
  y: number;
  currentStyle: number;
  onPick: (style: number) => void;
  onDelete: () => void;
  onDismiss: () => void;
}

const MARKER_STYLES = [0, 1, 2, 3, 4, 11, 104];
const UNDERLINE_STYLES = [8, 7, 6, 5, 9, 10, 12];

export function EditSelectionMenu({ x, y, currentStyle, onPick, onDelete, onDismiss }: Props) {
  return (
    <div
      role="dialog"
      className="fixed z-50 bg-paper border border-neutral-300 rounded-lg shadow-lg p-2 flex flex-col gap-1.5 -translate-x-1/2 -translate-y-[110%]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex gap-1">
        {MARKER_STYLES.map((s) => {
          const spec = STYLE_MAP[s]!;
          const active = s === currentStyle;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`マーカー ${spec.color} (style=${s})`}
              className={
                'w-6 h-6 rounded shadow-sm border ' +
                (active
                  ? 'border-ink ring-2 ring-ink'
                  : 'border-neutral-200')
              }
              style={{ background: spec.hex }}
            />
          );
        })}
      </div>
      <div className="flex gap-1">
        {UNDERLINE_STYLES.map((s) => {
          const spec = STYLE_MAP[s]!;
          const active = s === currentStyle;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`下線 ${spec.color} (style=${s})`}
              className={
                'w-6 h-6 rounded-md border flex items-end justify-center pb-0.5 bg-neutral-50 ' +
                (active
                  ? 'border-ink ring-2 ring-ink'
                  : 'border-neutral-200')
              }
            >
              <span
                className="block w-4 h-1 rounded-full"
                style={{ background: spec.hex }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between items-center pt-1">
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-red-600 hover:underline"
        >
          削除
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-neutral-500 hover:underline"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
