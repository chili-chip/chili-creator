import { AudioLines, Copy, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  addBlip,
  blipKindHints,
  blipKinds,
  blipName,
  blipOf,
  byId,
  chromaticNames,
  duplicateBlip,
  generateBlip,
  paceBlip,
  referencesTo,
  removeBlip,
  stretchBlip,
  transposeBlip,
  updateBlip,
  type Blip,
  type BlipKind,
  type Envelope,
  type Wave,
} from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useEditor, useSound, useWorld } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Checkbox, Input, Select } from '../../ui/input';
import { Segmented } from '../../ui/segmented';
import { Confirm, Empty } from '../shared';

export const waveOptions = [
  { value: 'P2', label: 'Square' },
  { value: 'P4', label: 'Thin' },
  { value: 'P8', label: 'Thinner' },
] as const;

const pitchOptions = [2, 3, 4, 5].flatMap((octave) => chromaticNames.map((name, note) => ({ value: `${note}:${octave}`, label: `${name}${octave}` })));

const envelopeFields: { key: keyof Envelope; label: string; max: number }[] = [
  { key: 'attack', label: 'Attack (ms)', max: 960 },
  { key: 'decay', label: 'Decay (ms)', max: 960 },
  { key: 'sustain', label: 'Sustain volume', max: 15 },
  { key: 'length', label: 'Length (ms)', max: 960 },
  { key: 'release', label: 'Release (ms)', max: 960 },
];

function NumberField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange(value: number): void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-muted">
      {label}
      <Input
        type="number"
        aria-label={label}
        min={0}
        max={max}
        value={value}
        className="w-20 text-right tabular-nums"
        onChange={(event) => {
          const n = Number(event.target.value);
          if (Number.isFinite(n)) onChange(Math.max(0, Math.min(max, Math.round(n))));
        }}
      />
    </label>
  );
}

/** The blip's pitches over its envelope: taller is louder, higher steps are higher notes. */
function Shape({ blip }: { blip: Blip }) {
  const { attack, decay, sustain, length, release } = blip.envelope;
  const total = Math.max(1, attack + decay + length + release);
  const x = (ms: number) => (ms / total) * 200;
  const y = (volume: number) => 40 - (volume / 15) * 36;
  const points = [
    [0, y(0)],
    [x(attack), y(10)],
    [x(attack + decay), y(sustain)],
    [x(attack + decay + length), y(sustain)],
    [200, y(0)],
  ];
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="h-12 w-full text-phosphor" aria-hidden>
      <polyline points={points.map((p) => p.join(',')).join(' ')} fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function Blips() {
  const creator = useCreator();
  const world = useWorld();
  const editor = useEditor();
  const playing = useSound();
  const [kind, setKind] = useState<BlipKind>('pick up');
  const [confirming, setConfirming] = useState(false);

  if (!world) return <Empty icon={<AudioLines />}>Open a game to make the sounds its sprites and items make.</Empty>;

  const block = (editor.blip !== null && byId(world.blips, editor.blip)) || world.blips[0];
  const blip = block && blipOf(world, block.id);

  function newBlip() {
    let made: Blip | undefined;
    creator.projects.updateWorld((w) => {
      made = blipOf(w, addBlip(w, kind));
    });
    setConfirming(false);
    if (!made) return;
    creator.editor.set({ blip: made.id });
    creator.sound.playBlip(made);
  }

  /** Changes the blip; `play` hears it straight after. */
  function edit(change: (b: Blip) => void, { group, play = false }: { group?: string; play?: boolean } = {}) {
    if (!blip) return;
    const id = blip.id;
    let changed: Blip | undefined;
    creator.projects.updateWorld(
      (w) => {
        updateBlip(w, id, (b) => {
          change(b);
          changed = b;
        });
      },
      group === undefined ? {} : { group },
    );
    if (play && changed) creator.sound.playBlip(changed);
  }

  const uses = blip ? referencesTo(world, { type: 'blip', id: blip.id }) : [];
  const isPlaying = playing.playing === 'blip' && playing.id === blip?.id;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        {blip && (
          <Select
            aria-label="Blip"
            value={blip.id}
            className="max-w-48"
            onChange={(event) => {
              setConfirming(false);
              creator.editor.set({ blip: event.target.value });
            }}
          >
            {world.blips.map((b) => (
              <option key={b.id} value={b.id}>
                {blipName(b)}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Kind" title={blipKindHints[kind]} value={kind} onChange={(event) => setKind(event.target.value as BlipKind)} className="w-28">
          {blipKinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={newBlip}>
          <Plus />
          New blip
        </Button>
        {blip && (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Copy blip"
              title="Copy blip"
              onClick={() => {
                let id: string | null = null;
                creator.projects.updateWorld((w) => {
                  id = duplicateBlip(w, blip.id);
                });
                if (id !== null) creator.editor.set({ blip: id });
              }}
            >
              <Copy />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Delete blip" title="Delete blip" onClick={() => setConfirming(true)}>
              <Trash2 />
            </Button>
          </>
        )}
        {confirming && blip && (
          <Confirm
            question={`Delete “${blipName(blip)}”${uses.length ? `? ${uses.map((u) => u.label).join(', ')} will go quiet` : ''}?`}
            onKeep={() => setConfirming(false)}
            onDelete={() => {
              creator.projects.updateWorld((w) => void removeBlip(w, blip.id));
              setConfirming(false);
              creator.editor.set({ blip: null });
            }}
          />
        )}
      </div>

      {!blip ? (
        <p className="text-sm text-muted">No blips yet. Pick a kind and make one: sprites and items play them when the avatar meets them.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              aria-label={isPlaying ? 'Stop' : 'Play blip'}
              onClick={() => (isPlaying ? creator.sound.stop() : creator.sound.playBlip(blip))}
            >
              {isPlaying ? <Square /> : <Play />}
              {isPlaying ? 'Stop' : 'Play'}
            </Button>
            <Button size="sm" variant="secondary" title={`A new ${kind} sound`} onClick={() => edit((b) => generateBlip(b, kind), { play: true })}>
              Make a new sound
            </Button>
            <Input
              aria-label="Blip name"
              value={blip.name ?? ''}
              placeholder={blipName({ id: blip.id })}
              className="min-w-24 flex-1"
              onChange={(event) => {
                const value = event.target.value;
                edit(
                  (b) => {
                    if (value) b.name = value;
                    else delete b.name;
                  },
                  { group: `blip-name-${blip.id}` },
                );
              }}
            />
          </div>

          <Shape blip={blip} />

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Pitch', ['Lower', (b: Blip) => transposeBlip(b, -1)], ['Higher', (b: Blip) => transposeBlip(b, 1)]],
                ['Length', ['Shorter', (b: Blip) => stretchBlip(b, 0.8)], ['Longer', (b: Blip) => stretchBlip(b, 1.25)]],
                ['Speed', ['Slower', (b: Blip) => paceBlip(b, 1.25)], ['Faster', (b: Blip) => paceBlip(b, 0.8)]],
              ] as const
            ).map(([title, ...buttons]) => (
              <div key={title} role="group" aria-label={title} className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">{title}</span>
                <div className="flex gap-1">
                  {buttons.map(([label, change]) => (
                    <Button key={label} size="sm" variant="secondary" className="flex-1 px-1" onClick={() => edit(change, { play: true })}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <span className="-mb-2 text-[11px] text-muted">Pitches, played in turn</span>
          <div className="grid grid-cols-3 gap-2">
            {blip.pitches.map((pitch, i) => (
              <Select
                key={i}
                aria-label={`Pitch ${i + 1}`}
                value={pitch.beats > 0 ? `${pitch.note}:${pitch.octave}` : ''}
                onChange={(event) => {
                  const [note, octave] = event.target.value.split(':').map(Number);
                  edit(
                    (b) => {
                      b.pitches[i] = event.target.value ? { beats: 1, note: note!, octave: octave! } : { beats: 0, note: 0, octave: 4 };
                    },
                    { play: true },
                  );
                }}
              >
                <option value="">None</option>
                {pitchOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ))}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-x-4">
            {envelopeFields.map((field) => (
              <NumberField
                key={field.key}
                label={field.label}
                value={blip.envelope[field.key]}
                max={field.max}
                onChange={(value) => edit((b) => (b.envelope[field.key] = value), { group: `blip-${blip.id}-${field.key}` })}
              />
            ))}
            <NumberField
              label="Step time (ms)"
              value={blip.beat.time}
              max={960}
              onChange={(value) => edit((b) => (b.beat.time = value), { group: `blip-${blip.id}-step` })}
            />
            <NumberField
              label="Step delay (ms)"
              value={blip.beat.delay}
              max={960}
              onChange={(value) => edit((b) => (b.beat.delay = value), { group: `blip-${blip.id}-delay` })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Tone" value={blip.instrument} options={waveOptions} onChange={(value: Wave) => edit((b) => (b.instrument = value), { play: true })} />
            <Checkbox
              label="Repeat the pitches"
              checked={blip.repeat}
              onChange={(event) => {
                const repeat = event.target.checked;
                edit((b) => (b.repeat = repeat), { play: true });
              }}
            />
          </div>

          <p className="text-[11px] text-muted">{uses.length ? `Made by ${uses.map((u) => u.label).join(', ')}` : 'Nothing makes this sound yet: pick it in Paint for a sprite or item.'}</p>
        </>
      )}
    </div>
  );
}

export default defineTool({
  id: 'blips',
  title: 'Blips',
  icon: AudioLines,
  component: Blips,
  defaultPosition: 'within',
  defaultReference: 'dialog',
  openByDefault: true,
  openInBackground: true,
});
