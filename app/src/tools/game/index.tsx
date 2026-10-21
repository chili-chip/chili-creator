import { Settings2 } from 'lucide-react';
import { AVATAR, byId } from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useCreator, useWorld } from '../../shell/creator-context';
import { Input, Select } from '../../ui/input';
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

function Game() {
  const creator = useCreator();
  const world = useWorld();
  if (!world) return <Empty icon={<Settings2 />}>Open a game to change its title, font and text direction.</Empty>;

  const avatar = byId(world.sprites, AVATAR);
  const start = avatar?.position && byId(world.rooms, avatar.position.room);
  const knownFont = fonts.some((f) => f.value === (world.defaultFont ?? 'ascii_small'));

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
        </Select>
      </label>

      <div className="flex flex-col gap-1 text-muted">
        Text direction
        <Segmented
          label="Text direction"
          value={world.textDirection === 'RTL' ? 'RTL' : 'LTR'}
          options={directions}
          onChange={(value) => creator.projects.updateWorld((w) => void (w.textDirection = value))}
        />
      </div>

      <p className="text-muted">
        {avatar?.position && start
          ? `Starts in ${roomName(start)} at ${avatar.position.x},${avatar.position.y}`
          : 'The avatar is not in a room yet, so the game cannot start.'}
      </p>
    </div>
  );
}

export default defineTool({
  id: 'game',
  title: 'Game',
  icon: Settings2,
  component: Game,
  defaultPosition: 'within',
  defaultReference: 'dialog',
});
