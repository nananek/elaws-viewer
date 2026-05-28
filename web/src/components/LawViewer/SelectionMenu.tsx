import { STYLE_MAP } from '@elaws/shared/styles';

interface Props {
  x: number;
  y: number;
  onPick: (style: number) => void;
  onDismiss: () => void;
}

const MARKER_STYLES = [0, 1, 2, 3, 4, 11, 104];
const UNDERLINE_STYLES = [8, 7, 6, 5, 9, 10, 12];

export function SelectionMenu({ x, y, onPick, onDismiss }: Props) {
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
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`マーカー ${spec.color} (style=${s})`}
              className="w-6 h-6 rounded shadow-sm border border-neutral-200"
              style={{ background: spec.hex }}
            />
          );
        })}
      </div>
      <div className="flex gap-1">
        {UNDERLINE_STYLES.map((s) => {
          const spec = STYLE_MAP[s]!;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`下線 ${spec.color} (style=${s})`}
              className="w-6 h-6 rounded-md border border-neutral-200 flex items-end justify-center pb-0.5 bg-neutral-50"
            >
              <span
                className="block w-4 h-1 rounded-full"
                style={{ background: spec.hex }}
              />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-neutral-500 hover:underline self-end"
      >
        キャンセル
      </button>
    </div>
  );
}
