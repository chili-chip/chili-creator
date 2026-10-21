import { ArrowLeft, ArrowRight, Copy, CopyPlus, Music, Play, Plus, Square, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  addBar,
  addTune,
  BAR_LENGTH,
  blipName,
  byId,
  chromaticNames,
  cycleOctave,
  duplicateTune,
  eraseNotes,
  keyNameOf,
  MAX_BARS,
  moveBar,
  noteAt,
  pitchRow,
  referencesTo,
  removeBar,
  removeTune,
  setKey,
  setNote,
  staffRows,
  tuneName,
  tuneOf,
  updateTune,
  type Arpeggio,
  type KeyName,
  type Part,
  type Tempo,
  type Tune,
  type Wave,
} from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useEditor, useSound, useWorld } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';
import { Checkbox, Input, Select } from '../../ui/input';
import { Segmented } from '../../ui/segmented';
import { waveOptions } from '../blips';
import { Confirm, Empty, newGroup } from '../shared';

const parts = [
  { value: 'melody', label: 'Melody' },
  { value: 'harmony', label: 'Harmony' },
] as const;

const pens = [
  { value: 'note', label: 'Note' },
  { value: 'blip', label: 'Blip' },
] as const;

const speeds = [
  { value: 'SLW', label: 'Slow' },
  { value: 'MED', label: 'Medium' },
  { value: 'FST', label: 'Fast' },
  { value: 'XFST', label: 'Turbo' },
] as const;

const scales: { value: KeyName | 'chromatic'; label: string; hint: string }[] = [
  { value: 'major', label: 'Major', hint: 'five cheerful notes' },
  { value: 'minor', label: 'Minor', hint: 'five gloomy notes' },
  { value: 'full major', label: 'Full major', hint: 'seven notes, cheerful' },
  { value: 'full minor', label: 'Full minor', hint: 'seven notes, gloomy' },
  { value: 'chromatic', label: 'Chromatic', hint: 'every note' },
];

const strums: { value: Arpeggio; label: string }[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'UP', label: 'Chord up' },
  { value: 'DWN', label: 'Chord down' },
  { value: 'INT5', label: 'Small interval' },
  { value: 'INT8', label: 'Big interval' },
];

/** "1.3": the bar's quarter, then the sixteenth in it. */
const beatName = (beat: number) => `${Math.floor(beat / 4) + 1}.${(beat % 4) + 1}`;
const rowName = (row: number) => (row === 12 ? 'High C' : chromaticNames[row]!);
const sharp = (row: number) => chromaticNames[row % 12]!.includes('#');

interface Drag {
  mode: 'add' | 'remove';
  row: number;
  start: number;
  end: number;
  group: string;
}

function Tunes() {
  const creator = useCreator();
  const world = useWorld();
  const editor = useEditor();
  const playing = useSound();
  const [barIndex, setBar] = useState(0);
  const [part, setPart] = useState<Part>('melody');
  const [pen, setPen] = useState<'note' | 'blip'>('note');
  const [penBlip, setPenBlip] = useState<string | null>(null);
  const [loopBar, setLoopBar] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const end = () => {
      if (!drag.current) return;
      drag.current = null;
      creator.projects.endGroup();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [creator]);

  if (!world) return <Empty icon={<Music />}>Open a game to write the music its rooms play.</Empty>;

  const block = (editor.tune !== null && byId(world.tunes, editor.tune)) || world.tunes[0];
  const tune = block && tuneOf(world, block.id);
  const bar = tune ? Math.min(barIndex, tune.melody.length - 1) : 0;

  function pick(id: string) {
    setConfirming(false);
    setBar(0);
    creator.editor.set({ tune: id });
  }

  function newTune() {
    let id = '';
    creator.projects.updateWorld((w) => {
      id = addTune(w);
    });
    pick(id);
  }

  if (!tune) {
    return (
      <div className="flex h-full flex-col items-start gap-3 p-3 text-sm text-muted">
        <p>No tunes yet. A room can play one while the avatar is in it.</p>
        <Button size="sm" variant="primary" onClick={newTune}>
          <Plus />
          New tune
        </Button>
      </div>
    );
  }

  const id = tune.id;
  const strumming = part === 'harmony' && tune.arpeggio !== 'OFF' && tune.key !== null;
  const blipForPen = pen === 'blip' ? ((penBlip !== null && byId(world.blips, penBlip)) || world.blips[0]) : undefined;
  const isPlaying = playing.playing === 'tune' && playing.id === id;
  const playhead = isPlaying && playing.bar === bar ? playing.beat : null;

  function edit(change: (t: Tune) => void, group?: string) {
    creator.projects.updateWorld((w) => void updateTune(w, id, change), group === undefined ? {} : { group });
  }

  function hear(row: number) {
    if (!tune) return;
    const octave = (part === 'melody' ? 4 : 2) + (row === 12 ? 1 : 0);
    creator.sound.playNote({ beats: 1, note: row % 12, octave }, part === 'melody' ? tune.instrumentA : tune.instrumentB);
  }

  /** Starts a stroke on a cell: writes a note there, or takes away the note that is there. */
  function press(row: number, beat: number) {
    if (!tune) return;
    const group = newGroup('tune');
    if (strumming) beat = 0;
    const at = noteAt(tune, part, bar, beat);
    const same = at !== null && pitchRow(tune, part, tune[part][bar]![at]!) === row;
    if (same) {
      drag.current = strumming || pen === 'blip' ? null : { mode: 'remove', row, start: beat, end: beat, group };
      edit((t) => eraseNotes(t, part, bar, beat, beat), group);
    } else {
      drag.current = strumming || pen === 'blip' ? null : { mode: 'add', row, start: beat, end: beat, group };
      const options = strumming ? { beats: BAR_LENGTH } : blipForPen ? { blip: blipForPen.id } : {};
      edit((t) => setNote(t, part, bar, beat, row, options), group);
      if (!blipForPen) hear(row);
    }
    if (!drag.current) creator.projects.endGroup();
  }

  /** Carries the stroke on to another cell. */
  function extend(row: number, beat: number) {
    const current = drag.current;
    if (!current) return;
    if (current.mode === 'add' && row !== current.row) {
      // A new row starts a new note.
      drag.current = { ...current, row, start: beat, end: beat };
      edit((t) => setNote(t, part, bar, beat, row), current.group);
      hear(row);
      return;
    }
    const start = Math.min(current.start, beat);
    const end = Math.max(current.end, beat);
    if (start === current.start && end === current.end) return;
    drag.current = { ...current, start, end };
    if (current.mode === 'add') edit((t) => setNote(t, part, bar, start, current.row, { beats: end - start + 1 }), current.group);
    else edit((t) => eraseNotes(t, part, bar, start, end), current.group);
  }

  function onCellDown(event: PointerEvent<HTMLDivElement>, row: number, beat: number) {
    event.preventDefault();
    // Let the other cells see the pointer, also for touch.
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    press(row, beat);
  }

  function onGridMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || typeof document.elementFromPoint !== 'function') return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-beat]');
    if (cell) extend(Number(cell.dataset.row), Number(cell.dataset.beat));
  }

  function onCellKey(event: KeyboardEvent<HTMLDivElement>, row: number, beat: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    press(row, beat);
    drag.current = null;
    creator.projects.endGroup();
  }

  const rows = [...staffRows(tune)].reverse();
  const notes = tune[part][bar]!;
  const covering = (row: number, beat: number) => {
    const at = noteAt(tune, part, bar, beat);
    return at !== null && pitchRow(tune, part, notes[at]!) === row ? at : null;
  };
  const uses = referencesTo(world, { type: 'tune', id });
  const keyName = keyNameOf(tune);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Tune" value={id} className="max-w-48" onChange={(event) => pick(event.target.value)}>
          {world.tunes.map((t) => (
            <option key={t.id} value={t.id}>
              {tuneName(t)}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={newTune}>
          <Plus />
          New tune
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copy tune"
          title="Copy tune"
          onClick={() => {
            let copy: string | null = null;
            creator.projects.updateWorld((w) => {
              copy = duplicateTune(w, id);
            });
            if (copy !== null) pick(copy);
          }}
        >
          <Copy />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Delete tune" title="Delete tune" onClick={() => setConfirming(true)}>
          <Trash2 />
        </Button>
        {confirming && (
          <Confirm
            question={`Delete “${tuneName(tune)}”${uses.length ? `? ${uses.map((u) => u.label).join(', ')} will go quiet` : ''}?`}
            onKeep={() => setConfirming(false)}
            onDelete={() => {
              if (isPlaying) creator.sound.stop();
              creator.projects.updateWorld((w) => void removeTune(w, id));
              setConfirming(false);
              creator.editor.set({ tune: null });
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          aria-label={isPlaying ? 'Stop' : 'Play tune'}
          onClick={() => (isPlaying ? creator.sound.stop() : creator.sound.playTune(tune, world, { bar, loopBar }))}
        >
          {isPlaying ? <Square /> : <Play />}
          {isPlaying ? 'Stop' : 'Play'}
        </Button>
        <Checkbox label="Repeat this bar" checked={loopBar} onChange={(event) => setLoopBar(event.target.checked)} />
        <Input
          aria-label="Tune name"
          value={tune.name ?? ''}
          placeholder={tuneName({ id })}
          className="min-w-24 flex-1"
          onChange={(event) => {
            const value = event.target.value;
            edit((t) => {
              if (value) t.name = value;
              else delete t.name;
            }, `tune-name-${id}`);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            label="Bars"
            value={String(bar)}
            options={tune.melody.map((_, i) => ({ value: String(i), label: `Bar ${i + 1}` }))}
            onChange={(value) => setBar(Number(value))}
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Add bar"
          title="Add bar"
          disabled={tune.melody.length >= MAX_BARS}
          onClick={() => {
            edit((t) => void addBar(t));
            setBar(tune.melody.length);
          }}
        >
          <Plus />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copy bar"
          title="Copy bar to the end"
          disabled={tune.melody.length >= MAX_BARS}
          onClick={() => {
            edit((t) => void addBar(t, bar));
            setBar(tune.melody.length);
          }}
        >
          <CopyPlus />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Move bar left" title="Move bar left" disabled={bar === 0} onClick={() => {
          edit((t) => void moveBar(t, bar, bar - 1));
          setBar(bar - 1);
        }}>
          <ArrowLeft />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Move bar right"
          title="Move bar right"
          disabled={bar >= tune.melody.length - 1}
          onClick={() => {
            edit((t) => void moveBar(t, bar, bar + 1));
            setBar(bar + 1);
          }}
        >
          <ArrowRight />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Remove bar"
          title="Remove bar"
          disabled={tune.melody.length <= 1}
          onClick={() => {
            edit((t) => void removeBar(t, bar));
            setBar(Math.max(0, bar - 1));
          }}
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Part" value={part} options={parts} onChange={(value: Part) => setPart(value)} />
        {!strumming && (
          <Segmented label="Pen" value={pen} options={pens} onChange={(value: 'note' | 'blip') => setPen(value)} />
        )}
        {pen === 'blip' && !strumming && (
          <Select
            aria-label="Blip to play"
            value={blipForPen?.id ?? ''}
            className="max-w-40"
            onChange={(event) => setPenBlip(event.target.value)}
            disabled={world.blips.length === 0}
          >
            {world.blips.length === 0 && <option value="">No blips yet</option>}
            {world.blips.map((b) => (
              <option key={b.id} value={b.id}>
                {blipName(b)}
              </option>
            ))}
          </Select>
        )}
      </div>

      {strumming && <p className="text-[11px] text-muted">Strum is on: pick the note the harmony strums its chord from in this bar.</p>}

      <div
        role="grid"
        aria-label={`${part === 'melody' ? 'Melody' : 'Harmony'}, bar ${bar + 1}`}
        className="grid w-full max-w-[640px] touch-none select-none gap-px"
        style={{ gridTemplateColumns: `3rem repeat(${BAR_LENGTH}, minmax(0, 1fr))` }}
        onPointerMove={onGridMove}
      >
        {rows.map((row) => (
          <div role="row" key={row} className="contents">
            <div role="rowheader" className="pr-1 text-right font-mono text-[10px] leading-5 text-muted">
              {rowName(row)}
            </div>
            {Array.from({ length: BAR_LENGTH }, (_, beat) => {
              const start = covering(row, beat);
              const on = start !== null;
              const effect = on ? notes[start]!.blip : undefined;
              return (
                <div
                  key={beat}
                  role="gridcell"
                  tabIndex={row === rows[0] && beat === 0 ? 0 : -1}
                  aria-label={`${rowName(row)} at beat ${beatName(beat)}`}
                  aria-selected={on}
                  data-row={row}
                  data-beat={beat}
                  title={effect !== undefined ? blipName(byId(world.blips, effect) ?? { id: effect }) : undefined}
                  className={cn(
                    'h-5 cursor-pointer rounded-[2px] focus-visible:outline-1 focus-visible:outline-phosphor',
                    sharp(row) ? 'bg-bg-0' : 'bg-bg-3',
                    beat % 4 === 0 && 'shadow-[inset_1px_0_0_var(--color-muted)]',
                    playhead === beat && 'bg-line',
                    on && (start === beat ? 'bg-chili' : 'bg-chili/60'),
                    on && effect !== undefined && 'bg-phosphor',
                  )}
                  onPointerDown={(event) => onCellDown(event, row, beat)}
                  onPointerEnter={() => extend(row, beat)}
                  onKeyDown={(event) => onCellKey(event, row, beat)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid w-full max-w-[640px] gap-px" style={{ gridTemplateColumns: `3rem repeat(${BAR_LENGTH}, minmax(0, 1fr))` }}>
        <span className="pr-1 text-right text-[10px] leading-6 text-muted">octave</span>
        {notes.map((pitch, beat) =>
          pitch.beats > 0 && (!strumming || beat === 0) ? (
            <button
              key={beat}
              type="button"
              aria-label={`Octave of the note at beat ${beatName(beat)}: ${pitch.octave}`}
              title="Octave: click to go up"
              className="h-6 rounded-[2px] bg-bg-1 font-mono text-[10px] text-text hover:bg-bg-3"
              onClick={() => edit((t) => cycleOctave(t, part, bar, beat))}
            >
              {pitch.octave}
            </button>
          ) : (
            <span key={beat} />
          ),
        )}
      </div>

      <div className="grid gap-2 text-xs text-muted sm:grid-cols-2">
        <label className="flex items-center justify-between gap-2">
          Scale
          <Select
            aria-label="Scale"
            value={keyName}
            className="w-36"
            onChange={(event) => edit((t) => setKey(t, event.target.value as KeyName | 'chromatic'))}
          >
            {scales.map((s) => (
              <option key={s.value} value={s.value} title={s.hint}>
                {s.label}
              </option>
            ))}
            {keyName === 'custom' && (
              <option value="custom" disabled>
                Custom
              </option>
            )}
          </Select>
        </label>
        <label className="flex items-center justify-between gap-2">
          Strum
          <Select
            aria-label="Strum"
            value={tune.key ? tune.arpeggio : 'OFF'}
            className="w-36"
            disabled={!tune.key}
            title={tune.key ? 'The harmony strums a chord' : 'Pick a scale to strum'}
            onChange={(event) => edit((t) => (t.arpeggio = event.target.value as Arpeggio))}
          >
            {strums.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center justify-between gap-2">
          Melody tone
          <Select aria-label="Melody tone" value={tune.instrumentA} className="w-36" onChange={(event) => edit((t) => (t.instrumentA = event.target.value as Wave))}>
            {waveOptions.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center justify-between gap-2">
          Harmony tone
          <Select aria-label="Harmony tone" value={tune.instrumentB} className="w-36" onChange={(event) => edit((t) => (t.instrumentB = event.target.value as Wave))}>
            {waveOptions.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          Speed
          <Segmented label="Speed" value={tune.tempo} options={speeds} onChange={(value: Tempo) => edit((t) => (t.tempo = value))} />
        </div>
      </div>

      <p className="text-[11px] text-muted">
        {uses.length ? `Plays in ${uses.map((u) => u.label).join(', ')}` : 'No room plays this yet: pick it as a room’s Music in the Room tool.'}
      </p>
    </div>
  );
}

export default defineTool({
  id: 'tunes',
  title: 'Tunes',
  icon: Music,
  component: Tunes,
  defaultPosition: 'within',
  defaultReference: 'dialog',
  openByDefault: true,
  openInBackground: true,
});
