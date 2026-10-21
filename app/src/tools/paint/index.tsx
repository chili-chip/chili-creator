import { Brush, Eraser, FlipHorizontal2, FlipVertical2, PaintBucket, Pencil } from 'lucide-react';
import { useRef } from 'react';
import {
  byId,
  clearFrame,
  colorsFor,
  drawingPixels,
  drawingsOf,
  fillPixels,
  flipDrawing,
  setAnimated,
  setPixel,
  type Drawing,
  type World,
} from '../../bitsy';
import type { PaintTool } from '../../project/editor';
import { defineTool } from '../../plugin-api';
import { useCreator, useEditor, useSelection } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Checkbox, Input } from '../../ui/input';
import { PixelCanvas } from '../../ui/pixel-canvas';
import { Segmented } from '../../ui/segmented';
import { drawingName, Empty, kinds, newGroup } from '../shared';

const paintTools = [
  { value: 'pencil', label: 'Pencil', icon: Pencil, hint: 'B' },
  { value: 'fill', label: 'Fill', icon: PaintBucket, hint: 'F' },
] as const;

function Paint() {
  const creator = useCreator();
  const editor = useEditor();
  const { world, room, kind, drawing, frame } = useSelection();
  const stroke = useRef<{ group: string; value: number } | null>(null);

  if (!world || !kind || !drawing) {
    return (
      <Empty icon={<Brush />}>
        {world ? 'Pick a tile, sprite or item in the Library to paint it.' : 'Open a game to paint its tiles and sprites.'}
      </Empty>
    );
  }

  const id = drawing.id;
  const pixels = drawing.frames[frame] ?? drawing.frames[0]!;
  const name = drawingName(kind, drawing);

  /** Changes the picked drawing in the world. */
  function edit(recipe: (d: Drawing, w: World) => void, group?: string) {
    creator.projects.updateWorld(
      (w) => {
        const target = byId(drawingsOf(w, kind!), id);
        if (target) recipe(target, w);
      },
      group === undefined ? {} : { group },
    );
  }

  function paint(x: number, y: number, first: boolean) {
    if (first) {
      stroke.current = { group: newGroup('paint'), value: pixels[y * 8 + x] ? 0 : 1 };
    }
    const current = stroke.current;
    if (!current) return;
    if (editor.paintTool === 'fill') {
      if (first) edit((d) => fillPixels(d, frame, x, y, current.value), current.group);
      return;
    }
    edit((d) => setPixel(d, frame, x, y, current.value), current.group);
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex items-center gap-2">
        <span className="rounded border border-line px-1.5 py-0.5 text-[10px] tracking-widest text-muted uppercase">
          {kinds[kind].title}
        </span>
        <Input
          aria-label="Name"
          placeholder={name}
          value={drawing.name ?? ''}
          className="flex-1"
          onChange={(event) => {
            const value = event.target.value;
            edit((d) => {
              if (value) d.name = value;
              else delete d.name;
            }, `name-${kind}-${id}`);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Segmented
          label="Paint tool"
          value={editor.paintTool}
          options={paintTools}
          onChange={(value: PaintTool) => creator.editor.set({ paintTool: value })}
          compact
        />
        <Button size="icon" variant="ghost" aria-label="Flip left to right" title="Flip left to right" onClick={() => edit((d) => flipDrawing(d, frame, 'x'))}>
          <FlipHorizontal2 />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Flip upside down" title="Flip upside down" onClick={() => edit((d) => flipDrawing(d, frame, 'y'))}>
          <FlipVertical2 />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Clear" title="Clear" onClick={() => edit((d) => clearFrame(d, frame))}>
          <Eraser />
        </Button>
      </div>

      <PixelCanvas
        label={`Drawing ${name}`}
        pixels={drawingPixels(drawing, frame, colorsFor(world, room?.id), kind)}
        width={8}
        height={8}
        columns={8}
        rows={8}
        className="mx-auto w-full max-w-64 shrink-0"
        onPaint={paint}
        onStrokeEnd={() => {
          stroke.current = null;
          creator.projects.endGroup();
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          label="Animated"
          checked={drawing.frames.length > 1}
          onChange={(event) => {
            const animated = event.target.checked;
            edit((d) => setAnimated(d, animated));
            if (!animated) creator.editor.set({ frame: 0 });
          }}
        />
        {drawing.frames.length > 1 && (
          <Segmented
            label="Frame"
            value={String(frame)}
            options={drawing.frames.map((_, i) => ({ value: String(i), label: `Frame ${i + 1}` }))}
            onChange={(value) => creator.editor.set({ frame: Number(value) })}
          />
        )}
        {kind === 'tiles' && (
          <Checkbox
            label="Wall"
            title="The avatar cannot walk through it"
            checked={Boolean((drawing as { wall?: boolean }).wall)}
            onChange={(event) => {
              const wall = event.target.checked;
              edit((d) => {
                const tile = d as { wall?: boolean };
                if (wall) tile.wall = true;
                else delete tile.wall;
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

export default defineTool({
  id: 'paint',
  title: 'Paint',
  icon: Brush,
  component: Paint,
  defaultPosition: 'right',
  defaultReference: 'room',
  openByDefault: true,
});
