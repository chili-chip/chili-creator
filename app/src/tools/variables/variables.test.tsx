import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { byId, dialogText, setDialogText } from '../../bitsy';
import { renderTool } from '../../test/creator';
import variables from '.';

const Variables = variables.component;

describe('Variables', () => {
  it('lists variables with their start values and where they are used', async () => {
    const { creator } = await renderTool(Variables);
    act(() => creator.projects.updateWorld((w) => setDialogText(w, '0', '{a = a + 1}')));
    expect(screen.getByRole('textbox', { name: 'Name of a' })).toHaveValue('a');
    expect(screen.getByRole('textbox', { name: 'Start value of a' })).toHaveValue('42');
    expect(screen.getByText('Used in 1 dialog')).toBeInTheDocument();
  });

  it('adds a variable', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Variables);
    await user.click(screen.getByRole('button', { name: 'New variable' }));
    expect(byId(world().variables, 'b')!.value).toBe('0');
    // Neither a nor the new b is used by a dialog.
    expect(screen.getAllByText('Not used yet')).toHaveLength(2);
  });

  it('renames a variable in the dialogs too, when the name is let go', async () => {
    const user = userEvent.setup();
    const { creator, world } = await renderTool(Variables);
    act(() => creator.projects.updateWorld((w) => setDialogText(w, '0', '{say a}')));
    const name = screen.getByRole('textbox', { name: 'Name of a' });
    await user.clear(name);
    await user.type(name, 'meows{Enter}');
    expect(byId(world().variables, 'meows')).toBeDefined();
    expect(dialogText(world(), '0')).toBe('{say meows}');
  });

  it('keeps the old name when the new one is taken', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Variables);
    await user.click(screen.getByRole('button', { name: 'New variable' }));
    const name = screen.getByRole('textbox', { name: 'Name of b' });
    await user.clear(name);
    await user.type(name, 'a');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('“a” is taken or is not a name');
    expect(byId(world().variables, 'b')).toBeDefined();
    expect(name).toHaveValue('b');
  });

  it('changes the start value and deletes a variable', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Variables);
    const value = screen.getByRole('textbox', { name: 'Start value of a' });
    await user.clear(value);
    await user.type(value, '7');
    expect(byId(world().variables, 'a')!.value).toBe('7');
    await user.click(screen.getByRole('button', { name: 'Delete a' }));
    expect(world().variables).toEqual([]);
    expect(screen.getByText(/No variables yet/)).toBeInTheDocument();
  });
});
