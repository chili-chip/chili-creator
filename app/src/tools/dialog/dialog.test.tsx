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
    expect(within(blocks).getByRole('combobox', { name: 'Order' })).toHaveDisplayValue('In order, then again from the top');
    expect(within(blocks).getByDisplayValue('bye')).toBeInTheDocument();
    expect(within(blocks).getByRole('textbox', { name: 'Condition' })).toHaveValue('a > 1');
    expect(within(blocks).getByRole('combobox', { name: 'Variable' })).toHaveValue('a');
    expect(within(blocks).getByRole('textbox', { name: 'Value' })).toHaveValue('a + 1');
    expect(within(blocks).getByText('Otherwise')).toBeInTheDocument();
    expect(within(blocks).getByText('End the game', { selector: 'span' })).toBeInTheDocument();
  });

  /** The cat's dialog in the block view. */
  async function blocksOf(script: string) {
    const user = userEvent.setup();
    const view = await renderTool(Dialog);
    act(() => {
      view.creator.projects.updateWorld((w) => setDialogText(w, '0', script));
      view.creator.editor.select({ kind: 'sprites', id: 'a' });
    });
    await user.click(screen.getByRole('radio', { name: 'Blocks' }));
    const text = () => dialogText(view.world(), '0');
    return { ...view, user, text, blocks: () => screen.getByRole('list', { name: 'Blocks' }) };
  }

  it('edits, moves and removes blocks', async () => {
    const { user, text, blocks } = await blocksOf('hello{pg}bye');
    const items = () => within(blocks()).getAllByRole('listitem');
    await user.type(within(items()[0]!).getByRole('textbox', { name: 'Text' }), '!');
    expect(text()).toBe('hello!{pg}bye');
    await user.click(within(items()[2]!).getByRole('button', { name: 'Move up' }));
    expect(text()).toBe('hello!bye{pg}');
    // Text next to text reads back as one block.
    expect(items()).toHaveLength(2);
    await user.click(within(items()[1]!).getByRole('button', { name: 'Remove block' }));
    expect(text()).toBe('hello!bye');
  });

  it('adds every kind of action, filled in for this game', async () => {
    const { user, text, blocks } = await blocksOf('hi');
    const add = (label: string) => user.selectOptions(screen.getAllByRole('combobox', { name: 'Add a block' }).at(-1)!, label);
    await add('Lock or unlock the exit');
    expect(text()).toBe('hi\n{property locked true}');
    await user.selectOptions(within(blocks()).getByRole('combobox', { name: 'Locked' }), 'Unlocked');
    expect(text()).toBe('hi\n{property locked false}');
    await add('Set how many of an item');
    expect(text()).toContain('{item "1" 10}');
    await add('One more of an item');
    expect(text()).toContain('{item "1" {{item "1"} + 1}}');
    await add('Show how many of an item');
    expect(text()).toContain('{say {item "1"}}');
    await add('Change the palette');
    expect(text()).toContain('{pal "0"}');
    await add('Change the avatar');
    expect(text()).toContain('{ava "a"}');
    await add('Play a blip');
    expect(text()).toContain('{blip "1"}');
    await add('Play a tune');
    expect(text()).toContain('{tune "1"}');
    await add('Go to a room');
    expect(text()).toContain('{exit "0" 8 8}');
    await user.selectOptions(within(blocks()).getAllByRole('combobox', { name: 'Transition' }).at(-1)!, 'Fade to white');
    expect(text()).toContain('{exit "0" 8 8 "fade_w"}');
  });

  it('builds choices: options, conditions and otherwise', async () => {
    const { user, text, blocks } = await blocksOf('hi');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add a block' }), 'Say lines in order');
    await user.click(within(blocks()).getByRole('button', { name: 'Add option' }));
    expect(text()).toBe('hi\n{sequence\n  - the first time\n  - every time after\n  - ...\n}');
    await user.selectOptions(within(blocks()).getByRole('combobox', { name: 'Order' }), 'In any order');
    expect(text()).toContain('{shuffle');
    await user.click(within(blocks()).getAllByRole('button', { name: 'Remove option' })[0]!);
    expect(text()).toBe('hi\n{shuffle\n  - every time after\n  - ...\n}');

    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Add a block' }).at(-1)!, 'If a variable is…');
    const condition = within(blocks()).getByRole('textbox', { name: 'Condition' });
    await user.clear(condition);
    await user.type(condition, 'a > 2');
    expect(text()).toContain('  - a > 2 ?');
    await user.click(within(blocks()).getByRole('button', { name: 'Add a condition' }));
    expect(text()).toMatch(/- a == 1 \?\n    \.\.\.\n  - else \?/);
  });

  it('shows the problems in this dialog', async () => {
    const { creator } = await renderTool(Dialog);
    act(() => {
      creator.projects.updateWorld((w) => setDialogText(w, '0', '{exit "attic" 1 1}'));
      creator.editor.select({ kind: 'sprites', id: 'a' });
    });
    expect(screen.getByText('cat dialog exits to room "attic", which does not exist.')).toBeInTheDocument();
  });

  it('inserts the actions the block view has in the text view too', async () => {
    const user = userEvent.setup();
    const { creator, world } = await renderTool(Dialog);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    const text = screen.getByRole('textbox', { name: 'Dialog text' }) as HTMLTextAreaElement;
    await user.clear(text);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Insert' }), 'Lock or unlock the exit');
    expect(dialogText(world(), '0')).toBe('{property locked true}');
  });

  it('makes, copies and deletes dialogs nobody has to own', async () => {
    const user = userEvent.setup();
    const { creator, world } = await renderTool(Dialog);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    await user.click(screen.getByRole('button', { name: 'Copy dialog' }));
    const copy = creator.editor.getState().dialog!;
    expect(byId(world().dialogs, copy)).toMatchObject({ name: 'cat dialog copy' });
    expect(dialogText(world(), copy)).toBe("I'm a cat");
    await user.click(screen.getByRole('button', { name: 'New dialog' }));
    const made = creator.editor.getState().dialog!;
    expect(dialogText(world(), made)).toBe('');
    expect(screen.getByText('Nobody says this yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete dialog' }));
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(byId(world().dialogs, made)).toBeUndefined();

    act(() => creator.editor.set({ dialog: '0' }));
    await user.click(screen.getByRole('button', { name: 'Delete dialog' }));
    expect(screen.getByText(/cat will have nothing to say/)).toBeInTheDocument();
  });
});
