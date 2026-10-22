import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';

// A short first-run tour. It does not block the page: people can try each
// tool while the card explains it, and skip it any time.

export const TOUR_KEY = 'chili.creator.tour.v1';

export function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'done';
  } catch {
    return true;
  }
}

function markTourDone() {
  try {
    localStorage.setItem(TOUR_KEY, 'done');
  } catch {
    // Blocked storage: the tour may show again next visit.
  }
}

interface Step {
  title: string;
  text: string;
  /** The `data-tour` element to outline. */
  target: 'tools' | 'workspace' | 'commands';
  /** The tool to open for this step. */
  tool?: string;
}

const steps = (phone: boolean): Step[] => [
  {
    title: 'Your tools',
    text: phone
      ? 'Every tool is in this bar. Tap one to open it; slide the bar to see them all.'
      : 'Every tool is in this bar. Click one to open it, then drag its tab to put it beside the others.',
    target: 'tools',
  },
  {
    title: 'Your games',
    text: 'Projects lists your games. Make a new one, open one, or import a .bitsy file or a Bitsy web page.',
    target: 'workspace',
    tool: 'projects',
  },
  {
    title: 'Rooms',
    text: 'Rooms are where your game happens. Pick a tile, sprite or item in Library and draw it into the room.',
    target: 'workspace',
    tool: 'room',
  },
  {
    title: 'Paint',
    text: 'Paint draws the tile, sprite or item you picked, one frame or two for animation.',
    target: 'workspace',
    tool: 'paint',
  },
  {
    title: 'Play',
    text: 'Play your game any time. Your work saves itself as you go, and Download makes a web page or a GIF of it.',
    target: 'workspace',
    tool: 'play',
  },
  phone
    ? {
        title: 'Words and sounds',
        text: 'Dialog, Exits & endings, Tunes and Blips are further along the bar. Have fun!',
        target: 'tools',
      }
    : {
        title: 'Commands and layouts',
        text: 'Press Ctrl+K to find any command. The Layout menu below sets the tools up for drawing, writing, sound or playtesting.',
        target: 'commands',
      },
];

function useOutline(target: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const element = document.querySelector(`[data-tour="${target}"]`);
    function measure() {
      setRect(element && element.getClientRects().length ? element.getBoundingClientRect() : null);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [target]);
  return rect;
}

export function Tour({ phone, onOpenTool, onClose }: { phone: boolean; onOpenTool(id: string): void; onClose(): void }) {
  const all = steps(phone);
  const [index, setIndex] = useState(0);
  const step = all[index]!;
  const last = index === all.length - 1;
  const rect = useOutline(step.target);

  useEffect(() => {
    if (step.tool) onOpenTool(step.tool);
  }, [step.tool, onOpenTool]);

  function close() {
    markTourDone();
    onClose();
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-md ring-2 ring-chili ring-offset-2 ring-offset-bg-0 transition-all"
          style={{ left: rect.left + 2, top: rect.top + 2, width: rect.width - 4, height: rect.height - 4 }}
        />
      )}
      <section
        role="dialog"
        aria-label="Tour"
        aria-modal="false"
        className={cn(
          'fixed z-50 space-y-2 rounded-md border border-line bg-bg-2 p-3 text-sm shadow-xl',
          phone ? 'inset-x-3 top-14' : 'right-4 bottom-10 w-80',
        )}
      >
        <p className="text-[11px] text-muted">
          Step {index + 1} of {all.length}
        </p>
        <h2 className="font-display text-base font-bold">{step.title}</h2>
        <p className="text-xs text-muted">{step.text}</p>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={close}>
            Skip tour
          </Button>
          <span className="ml-auto" />
          {index > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" variant="primary" autoFocus onClick={() => (last ? close() : setIndex(index + 1))}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </section>
    </>
  );
}
