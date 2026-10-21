import { Download, Settings2, Upload } from 'lucide-react';
import { useState } from 'react';
import { AVATAR, byId, fontFile, parse, readFontFile, setCustomFont, type World } from '../../bitsy';
import { download } from '../../export/files';
import { defineTool } from '../../plugin-api';
import { useCreator, useWorld } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select, Textarea } from '../../ui/input';
import { Segmented } from '../../ui/segmented';
import { Empty, roomName } from '../shared';

/** Bitsy's fonts; ASCII small is the default and is not written to the file. */
const fonts = [
  { value: 'ascii_small', label: 'ASCII small' },
  { value: 'unicode_european_small', label: 'European small' },
  { value: 'unicode_european_large', label: 'European large' },
  { value: 'unicode_asian', label: 'Asian' },
  { value: 'arabic', label: 'Arabic' },
];

const directions = [
  { value: 'LTR', label: 'Left to right' },
  { value: 'RTL', label: 'Right to left' },
] as const;

const textModes = [
  { value: '0', label: 'Default' },
  { value: '1', label: 'Chunky' },
] as const;

/** Replaces everything in `world` with `next`, in place, for an undoable edit. */
function replaceWorld(world: World, next: World) {
  for (const key of Object.keys(world)) delete (world as unknown as Record<string, unknown>)[key];
  Object.assign(world, next);
}

function GameData() {
  const creator = useCreator();
  const [draft, setDraft] = useState('');
  const [issues, setIssues] = useState<string[]>([]);

  function apply() {
    const parsed = parse(draft);
    setIssues(parsed.issues.map((issue) => `Line ${issue.line}: ${issue.message}`));
    creator.projects.updateWorld((world) => replaceWorld(world, parsed.world));
  }

  return (
    <details
      className="rounded-md border border-line p-2"
      onToggle={(event) => {
        if ((event.target as HTMLDetailsElement).open) setDraft(creator.projects.data());
      }}
    >
      <summary className="cursor-pointer text-text">Game data</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p>The whole game as .bitsy text. Changes here can break the game; Undo brings it back.</p>
        <Textarea
          aria-label="Game data"
          spellCheck={false}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="h-64 w-full"
        />
        <Button size="sm" className="w-fit" onClick={apply}>
          Apply game data
        </Button>
        {issues.length > 0 && (
          <ul className="list-disc pl-4 text-chili">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function Game() {
  const creator = useCreator();
  const world = useWorld();
  const [fontError, setFontError] = useState('');
  if (!world) return <Empty icon={<Settings2 />}>Open a game to change its title, font and text direction.</Empty>;

  const avatar = byId(world.sprites, AVATAR);
  const start = avatar?.position && byId(world.rooms, avatar.position.room);
  const custom = world.fonts.filter((f) => f.id !== 'ascii_small');
  const knownFont = [...fonts.map((f) => f.value), ...custom.map((f) => f.id)].includes(world.defaultFont ?? 'ascii_small');
  const ownFont = fontFile(world);

  async function loadFont(file: File) {
    const font = readFontFile(await file.text());
    if (!font) {
      setFontError(`${file.name} is not a .bitsyfont file.`);
      return;
    }
    setFontError('');
    creator.projects.updateWorld((w) => setCustomFont(w, font));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-3 text-xs">
      <label className="flex flex-col gap-1 text-muted">
        Title
        <Input value={world.title} onChange={(event) => creator.projects.setTitle(event.target.value)} />
      </label>

      <label className="flex flex-col gap-1 text-muted">
        Font
        <Select
          value={world.defaultFont ?? 'ascii_small'}
          onChange={(event) => {
            const font = event.target.value;
            creator.projects.updateWorld((w) => {
              if (font === 'ascii_small') delete w.defaultFont;
              else w.defaultFont = font;
            });
          }}
          className="w-fit"
        >
          {!knownFont && <option value={world.defaultFont}>{world.defaultFont}</option>}
          {fonts.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
          {custom.map((font) => (
            <option key={font.id} value={font.id}>
              {font.id} (custom)
            </option>
          ))}
        </Select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 text-text hover:bg-bg-3 focus-within:outline-2 focus-within:outline-phosphor [&_svg]:size-3.5">
          <Upload aria-hidden />
          Load font
          <input
            type="file"
            accept=".bitsyfont"
            aria-label="Load a .bitsyfont"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void loadFont(file);
            }}
          />
        </label>
        {ownFont && (
          <Button size="sm" variant="ghost" onClick={() => download(`${world.defaultFont}.bitsyfont`, ownFont, 'text/plain')}>
            <Download />
            Save font
          </Button>
        )}
      </div>
      {fontError && (
        <p role="alert" className="text-chili">
          {fontError}
        </p>
      )}

      <div className="flex flex-col gap-1 text-muted">
        Text direction
        <Segmented
          label="Text direction"
          value={world.textDirection === 'RTL' ? 'RTL' : 'LTR'}
          options={directions}
          onChange={(value) => creator.projects.updateWorld((w) => void (w.textDirection = value))}
        />
      </div>

      <div className="flex flex-col gap-1 text-muted">
        Text size
        <Segmented
          label="Text size"
          value={world.flags.TXT_MODE === '1' ? '1' : '0'}
          options={textModes}
          onChange={(value) => creator.projects.updateWorld((w) => void (w.flags.TXT_MODE = value))}
        />
      </div>

      <p className="text-muted">
        {avatar?.position && start
          ? `Starts in ${roomName(start)} at ${avatar.position.x},${avatar.position.y}`
          : 'The avatar is not in a room yet, so the game cannot start.'}
      </p>

      <GameData />
    </div>
  );
}

export default defineTool({
  id: 'game',
  title: 'Game',
  help: 'The title, font, text direction and text size, and the whole game as .bitsy text.',
  icon: Settings2,
  component: Game,
  defaultPosition: 'within',
  defaultReference: 'dialog',
});
