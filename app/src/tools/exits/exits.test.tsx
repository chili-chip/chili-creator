import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addEnding, addExit, addRoom, dialogText } from '../../bitsy';
import { placeOnScreen } from '../../test/canvas';
import { renderTool } from '../../test/creator';
import exits from '.';

const Exits = exits.component;

async function withMarkers() {
  const view = await renderTool(Exits);
  act(() =>
    view.creator.projects.updateWorld((w) => {
      addRoom(w);
      addExit(w, '0', 3, 4);
      addEnding(w, '0', 6, 6, 'Bye');
    }),
  );
  return view;
}

describe('Exits & endings', () => {
  it('says how to add one when the room has none', async () => {
    await renderTool(Exits);
    expect(screen.getByText(/No exits or endings in example room yet/)).toBeInTheDocument();
  });

  it('lists the room’s exits and endings, and picks one', async () => {
    const user = userEvent.setup();
    const { creator } = await withMarkers();
    await user.click(screen.getByRole('button', { name: 'Exit at 3,4 to Room 1' }));
    expect(creator.editor.getState().marker).toEqual({ x: 3, y: 4 });
    expect(screen.getByRole('button', { name: 'Exit at 3,4 to Room 1' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Ending at 6,6' }));
    expect(creator.editor.getState().marker).toEqual({ x: 6, y: 6 });
  });

  it('changes where an exit leads and how', async () => {
    const user = userEvent.setup();
    const { creator, world } = await withMarkers();
    act(() => creator.editor.set({ marker: { x: 3, y: 4 } }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destination room' }), 'example room');
    const map = screen.getByRole('application', { name: 'Destination example room' });
    placeOnScreen(map, 160, 160);
    fireEvent.pointerDown(map, { clientX: 95, clientY: 25, button: 0, pointerId: 1 });
    fireEvent.pointerUp(map, { pointerId: 1 });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Transition' }), 'Fade to white');
    expect(world().rooms[0]!.exits[0]).toEqual({ x: 3, y: 4, dest: { room: '0', x: 9, y: 2 }, transition: 'fade_w' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Transition' }), 'None');
    expect(world().rooms[0]!.exits[0]!.transition).toBeUndefined();
  });

  it('writes an ending’s text', async () => {
    const user = userEvent.setup();
    const { creator, world } = await withMarkers();
    act(() => creator.editor.set({ marker: { x: 6, y: 6 } }));
    const text = screen.getByRole('textbox', { name: 'Ending text' });
    expect(text).toHaveValue('Bye');
    await user.type(text, ' now');
    expect(dialogText(world(), world().rooms[0]!.endings[0]!.id)).toBe('Bye now');
  });

  it('removes an exit or an ending', async () => {
    const user = userEvent.setup();
    const { creator, world } = await withMarkers();
    act(() => creator.editor.set({ marker: { x: 3, y: 4 } }));
    await user.click(screen.getByRole('button', { name: 'Remove exit' }));
    expect(world().rooms[0]!.exits).toEqual([]);
    act(() => creator.editor.set({ marker: { x: 6, y: 6 } }));
    await user.click(screen.getByRole('button', { name: 'Remove ending' }));
    expect(world().rooms[0]!.endings).toEqual([]);
  });

  it('switches the Room to adding exits or endings', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Exits);
    await user.click(screen.getByRole('button', { name: 'Add an exit' }));
    expect(creator.editor.getState().roomTool).toBe('exit');
    await user.click(screen.getByRole('button', { name: 'Add an ending' }));
    expect(creator.editor.getState().roomTool).toBe('ending');
  });
});
