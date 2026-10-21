import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { byId, dialogText, setDialogText } from '../../bitsy';
import { renderTool } from '../../test/creator';
import dialog from '.';

const Dialog = dialog.component;

describe('Dialog', () => {
  it('shows what the picked sprite says, and who says it', async () => {
    const { creator } = await renderTool(Dialog);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    expect(screen.getByRole('textbox', { name: 'Dialog text' })).toHaveValue("I'm a cat");
    expect(screen.getByText('Said by cat')).toBeInTheDocument();
  });

  it('writes the dialog, one undo step while typing', async () => {
    const user = userEvent.setup();
    const { creator, world } = await renderTool(Dialog);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    const text = screen.getByRole('textbox', { name: 'Dialog text' });
    await user.type(text, '!{Enter}{Enter}meow');
    expect(dialogText(world(), '0')).toBe("I'm a cat!\n\nmeow");
    expect(byId(world().dialogs, '0')!.script).toBe('"""\nI\'m a cat!\n\nmeow\n"""');
    act(() => creator.projects.endGroup());
    act(() => void creator.projects.undo());
    expect(dialogText(world(), '0')).toBe("I'm a cat");
  });

  it('gives a sprite something to say when it has no dialog', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Dialog);
    expect(screen.getByText('avatar has nothing to say yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write what avatar says' }));
    const id = byId(world().sprites, 'A')!.dialog!;
    expect(byId(world().dialogs, id)).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Dialog text' })).toHaveValue('');
  });

  it('says tiles do not talk', async () => {
    const { creator } = await renderTool(Dialog);
    act(() => creator.editor.select({ kind: 'tiles', id: 'a' }));
    expect(screen.getByText(/Tiles do not talk/)).toBeInTheDocument();
  });

  it('picks any dialog in the game, and renames it', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Dialog);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Dialog' }), 'tea dialog');
    expect(screen.getByRole('textbox', { name: 'Dialog text' })).toHaveValue('You found a nice warm cup of tea');
    const name = screen.getByRole('textbox', { name: 'Dialog name' });
    await user.clear(name);
    await user.type(name, 'tea time');
    expect(byId(world().dialogs, '1')!.name).toBe('tea time');
  });

  it('inserts a piece of script where the cursor is', async () => {
    const user = userEvent.setup();
    const { creator, world } = await renderTool(Dialog);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    const text = screen.getByRole('textbox', { name: 'Dialog text' }) as HTMLTextAreaElement;
    text.setSelectionRange(0, 0);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Insert' }), 'End the game');
    expect(dialogText(world(), '0')).toBe("{end}I'm a cat");
    expect(screen.getByRole('combobox', { name: 'Insert' })).toHaveValue('');
  });

  it('shows the script as blocks', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Dialog);
    act(() => {
      creator.projects.updateWorld((w) =>
        setDialogText(w, '0', '{cycle\n  - hi\n  - bye\n}\n{\n  - a > 1 ?\n    {a = a + 1}\n  - else ?\n    {end}\n}'),
      );
      creator.editor.select({ kind: 'sprites', id: 'a' });
    });
    await user.click(screen.getByRole('radio', { name: 'Blocks' }));
    const blocks = screen.getByRole('list', { name: 'Blocks' });
    expect(within(blocks).getByText('In order, then again from the top')).toBeInTheDocument();
    expect(within(blocks).getByText('bye')).toBeInTheDocument();
    expect(within(blocks).getByText('If a > 1')).toBeInTheDocument();
    expect(within(blocks).getByText('Set a to a + 1')).toBeInTheDocument();
    expect(within(blocks).getByText('Otherwise')).toBeInTheDocument();
    expect(within(blocks).getByText('End the game')).toBeInTheDocument();
  });

  it('shows the problems in this dialog', async () => {
    const { creator } = await renderTool(Dialog);
    act(() => {
      creator.projects.updateWorld((w) => setDialogText(w, '0', '{exit "attic" 1 1}'));
      creator.editor.select({ kind: 'sprites', id: 'a' });
    });
    expect(screen.getByText('cat dialog exits to room "attic", which does not exist.')).toBeInTheDocument();
  });
});
