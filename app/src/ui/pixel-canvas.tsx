import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from './cn';

/** Puts RGBA pixels on a canvas at its own resolution; CSS scales it up. */
function usePaint(pixels: Uint8ClampedArray, width: number, height: number) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useLayoutEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    const image = context.createImageData(width, height);
    image.data.set(pixels.subarray(0, image.data.length));
    context.putImageData(image, 0, 0);
  }, [pixels, width, height]);
  return ref;
}

interface PixelImageProps {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  className?: string;
}

/** A small picture from pixels, like a tile thumbnail. */
export function PixelImage({ pixels, width, height, className }: PixelImageProps) {
  const ref = usePaint(pixels, width, height);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      aria-hidden
      className={cn('[image-rendering:pixelated]', className)}
    />
  );
}

export interface Cell {
  x: number;
  y: number;
}

/** The cells on a line from `from` to `to`, without `from` (Bresenham). */
export function cellsBetween(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = [];
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let { x, y } = from;
  let error = dx + dy;
  while (x !== to.x || y !== to.y) {
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
    cells.push({ x, y });
  }
  return cells;
}

interface PixelCanvasProps extends PixelImageProps {
  /** What the canvas edits, for screen readers ("Room", "Drawing"). */
  label: string;
  /** Grid cells the canvas is split into; a press lands in one. */
  columns: number;
  rows: number;
  grid?: boolean;
  /** A cell was painted; `first` is the press that starts a stroke. */
  onPaint(x: number, y: number, first: boolean): void;
  /** The stroke is over: the pointer was let go or the key press painted. */
  onStrokeEnd?(): void;
  onHover?(cell: Cell | null): void;
}

/**
 * The editing surface for rooms and drawings: a pixel picture split into
 * cells, painted with a mouse, pen, finger or the keyboard.
 */
export function PixelCanvas({
  label,
  pixels,
  width,
  height,
  columns,
  rows,
  grid = true,
  onPaint,
  onStrokeEnd,
  onHover,
  className,
}: PixelCanvasProps) {
  const surface = useRef<HTMLDivElement | null>(null);
  const stroke = useRef<{ pointer: number; last: Cell } | null>(null);
  const [cursor, setCursor] = useState<Cell>({ x: 0, y: 0 });
  const [keyboard, setKeyboard] = useState(false);

  // A smaller canvas (another drawing, a new room) keeps the cursor inside.
  useEffect(() => {
    setCursor((c) => ({ x: Math.min(c.x, columns - 1), y: Math.min(c.y, rows - 1) }));
  }, [columns, rows]);

  function cellAt(event: PointerEvent): Cell {
    const box = surface.current!.getBoundingClientRect();
    const clamp = (value: number, size: number) => Math.min(size - 1, Math.max(0, Math.floor(value)));
    return {
      x: clamp(((event.clientX - box.left) / (box.width || 1)) * columns, columns),
      y: clamp(((event.clientY - box.top) / (box.height || 1)) * rows, rows),
    };
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    surface.current?.focus({ preventScroll: true });
    setKeyboard(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const cell = cellAt(event);
    stroke.current = { pointer: event.pointerId, last: cell };
    onPaint(cell.x, cell.y, true);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const cell = cellAt(event);
    onHover?.(cell);
    const current = stroke.current;
    if (!current || current.pointer !== event.pointerId || !(event.buttons & 1)) return;
    if (cell.x === current.last.x && cell.y === current.last.y) return;
    for (const step of cellsBetween(current.last, cell)) onPaint(step.x, step.y, false);
    current.last = cell;
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (!stroke.current || stroke.current.pointer !== event.pointerId) return;
    stroke.current = null;
    onStrokeEnd?.();
  }

  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  function key(event: KeyboardEvent<HTMLDivElement>) {
    const step = moves[event.key];
    if (step) {
      event.preventDefault();
      setKeyboard(true);
      setCursor((c) => ({
        x: Math.min(columns - 1, Math.max(0, c.x + step[0])),
        y: Math.min(rows - 1, Math.max(0, c.y + step[1])),
      }));
      onHover?.(null);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      setKeyboard(true);
      onPaint(cursor.x, cursor.y, true);
      onStrokeEnd?.();
    }
  }

  const ref = usePaint(pixels, width, height);
  return (
    <div
      ref={surface}
      role="application"
      aria-label={label}
      aria-roledescription="pixel canvas"
      tabIndex={0}
      className={cn(
        'group relative aspect-square touch-none overflow-hidden rounded-md border border-line bg-black select-none focus-visible:outline-2 focus-visible:outline-phosphor',
        className,
      )}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={() => onHover?.(null)}
      onKeyDown={key}
      onFocus={(event) => {
        // Tabbing in shows the keyboard cursor; a click does not.
        if (event.target === event.currentTarget && !stroke.current) setKeyboard(true);
      }}
      onBlur={() => setKeyboard(false)}
    >
      <canvas ref={ref} width={width} height={height} className="size-full [image-rendering:pixelated]" />
      {grid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(255 255 255 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.12) 1px, transparent 1px)',
            backgroundSize: `${100 / columns}% ${100 / rows}%`,
          }}
        />
      )}
      {keyboard && (
        <div
          aria-hidden
          className="pointer-events-none absolute border-2 border-phosphor"
          style={{
            left: `${(cursor.x / columns) * 100}%`,
            top: `${(cursor.y / rows) * 100}%`,
            width: `${100 / columns}%`,
            height: `${100 / rows}%`,
          }}
        />
      )}
      <span className="sr-only" aria-live="polite">
        Column {cursor.x + 1}, row {cursor.y + 1}
      </span>
    </div>
  );
}
