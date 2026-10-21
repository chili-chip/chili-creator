import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { serialize } from '../../bitsy';
import { renderTool } from '../../test/creator';
import game from '.';

const saved = vi.hoisted(() => ({ files: [] as { name: string; content: unknown; type: string }[] }));
vi.mock('../../export/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../export/files')>()),
  download: (name: string, content: unknown, type: string) => saved.files.push({ name, content, type }),
}));

const fontText = 'FONT tiny\nSIZE 3 4\nCHAR 65\n010\n101\n111\n101\n';

const Game = game.component;

describe('Game', () => {
  it('renames the game', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Game);
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Moss');
    expect(world().title).toBe('Moss');
  });

  it('picks the font and text direction', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Game);
    const font = screen.getByRole('combobox', { name: 'Font' });
    expect(font).toHaveDisplayValue('ASCII small');
    await user.selectOptions(font, 'Arabic');
    await user.click(screen.getByRole('radio', { name: 'Right to left' }));
    expect(world().defaultFont).toBe('arabic');
    expect(world().textDirection).toBe('RTL');
    expect(serialize(world())).toContain('DEFAULT_FONT arabic');
    await user.selectOptions(font, 'ASCII small');
    await user.click(screen.getByRole('radio', { name: 'Left to right' }));
    expect(world().defaultFont).toBeUndefined();
    expect(world().textDirection).toBe('LTR');
  });

  it('says where the game starts', async () => {
    await renderTool(Game);
    expect(screen.getByText('Starts in example room at 4,4')).toBeInTheDocument();
  });

  it('switches to chunky text', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Game);
    expect(screen.getByRole('radio', { name: 'Default' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Chunky' }));
    expect(world().flags.TXT_MODE).toBe('1');
    await user.click(screen.getByRole('radio', { name: 'Default' }));
    expect(world().flags.TXT_MODE).toBe('0');
  });

  it('loads a custom font and saves it again', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Game);
    expect(screen.queryByRole('button', { name: 'Save font' })).toBeNull();
    await user.upload(screen.getByLabelText('Load a .bitsyfont'), new File([fontText], 'tiny.bitsyfont'));
    expect(await screen.findByRole('combobox', { name: 'Font' })).toHaveDisplayValue('tiny (custom)');
    expect(world().defaultFont).toBe('tiny');
    await user.click(screen.getByRole('button', { name: 'Save font' }));
    expect(saved.files.at(-1)).toEqual({ name: 'tiny.bitsyfont', content: fontText, type: 'text/plain' });
  });

  it('says when a file is not a font', async () => {
    const user = userEvent.setup();
    await renderTool(Game);
    await user.upload(screen.getByLabelText('Load a .bitsyfont'), new File(['hello'], 'x.bitsyfont'));
    expect(await screen.findByRole('alert')).toHaveTextContent('not a .bitsyfont');
  });

  it('edits the raw game data', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Game);
    await user.click(screen.getByText('Game data'));
    const data = screen.getByRole('textbox', { name: 'Game data' });
    expect(data).toHaveValue(serialize(world()));
    fireEvent.change(data, { target: { value: serialize(world()).replace('Test game', 'Raw game') } });
    await user.click(screen.getByRole('button', { name: 'Apply game data' }));
    expect(world().title).toBe('Raw game');
  });
});
