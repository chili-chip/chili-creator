import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { byId, keyNameOf, tuneOf } from '../../bitsy';
import { renderTool } from '../../test/creator';
import tunes from '.';

const Tunes = tunes.component;

describe('Tunes', () => {
  it('shows the first tune, with its settings and the rooms it plays in', async () => {
    await renderTool(Tunes);
    expect(screen.getByRole('combobox', { name: 'Tune' })).toHaveDisplayValue('finale fanfare');
    expect(screen.getByRole('combobox', { name: 'Scale' })).toHaveDisplayValue('Major');
    expect(screen.getByRole('radio', { name: 'Turbo' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Strum' })).toHaveDisplayValue('Big interval');
    expect(screen.getByRole('radiogroup', { name: 'Bars' }).querySelectorAll('[role=radio]')).toHaveLength(4);
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Tune' }), 'tuneful town');
    expect(screen.getByText('Plays in example room')).toBeInTheDocument();
  });

  it('writes a note with a click and takes it away with another', async () => {
    const { world, creator } = await renderTool(Tunes);
    await userEvent.setup().click(screen.getByRole('button', { name: 'New tune' }));
    const id = creator.editor.getState().tune!;
    expect(id).toBe('4');
    const staff = screen.getByRole('grid', { name: 'Melody, bar 1' });
    const cell = within(staff).getByRole('gridcell', { name: 'G at beat 1.3' });
    fireEvent.pointerDown(cell);
    fireEvent.pointerUp(cell);
    expect(tuneOf(world(), id)!.melody[0]![2]).toEqual({ beats: 1, note: 4, octave: 4 });
    expect(cell).toHaveAttribute('aria-selected', 'true');
    fireEvent.pointerDown(cell);
    fireEvent.pointerUp(cell);
    expect(tuneOf(world(), id)!.melody[0]![2]!.beats).toBe(0);
  });

  it('draws a long note by dragging along the row', async () => {
    const { world, creator } = await renderTool(Tunes);
    await userEvent.setup().click(screen.getByRole('button', { name: 'New tune' }));
    const id = creator.editor.getState().tune!;
    const staff = screen.getByRole('grid', { name: 'Melody, bar 1' });
    fireEvent.pointerDown(within(staff).getByRole('gridcell', { name: 'C at beat 1.1' }));
    fireEvent.pointerEnter(within(staff).getByRole('gridcell', { name: 'C at beat 1.2' }));
    fireEvent.pointerEnter(within(staff).getByRole('gridcell', { name: 'C at beat 1.3' }));
    fireEvent.pointerUp(window);
    expect(tuneOf(world(), id)!.melody[0]![0]).toEqual({ beats: 3, note: 0, octave: 4 });
    // One stroke is one undo step.
    act(() => creator.projects.undo());
    expect(tuneOf(world(), id)!.melody[0]![0]!.beats).toBe(0);
  });

  it('writes the harmony, bars, octave and settings', async () => {
    const user = userEvent.setup();
    const { world, creator } = await renderTool(Tunes);
    await user.click(screen.getByRole('button', { name: 'New tune' }));
    const id = creator.editor.getState().tune!;
    await user.click(screen.getByRole('radio', { name: 'Harmony' }));
    const staff = screen.getByRole('grid', { name: 'Harmony, bar 1' });
    fireEvent.pointerDown(within(staff).getByRole('gridcell', { name: 'A at beat 1.1' }));
    fireEvent.pointerUp(window);
    expect(tuneOf(world(), id)!.harmony[0]![0]).toEqual({ beats: 1, note: 5, octave: 2 });
    await user.click(screen.getByRole('button', { name: 'Octave of the note at beat 1.1: 2' }));
    expect(tuneOf(world(), id)!.harmony[0]![0]!.octave).toBe(3);

    await user.click(screen.getByRole('button', { name: 'Copy bar' }));
    expect(tuneOf(world(), id)!.harmony).toHaveLength(5);
    expect(screen.getByRole('radio', { name: 'Bar 5' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Remove bar' }));
    expect(tuneOf(world(), id)!.harmony).toHaveLength(4);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Scale' }), 'Chromatic');
    expect(keyNameOf(tuneOf(world(), id)!)).toBe('chromatic');
    expect(screen.getByRole('combobox', { name: 'Strum' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Slow' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Melody tone' }), 'Thinner');
    const tune = tuneOf(world(), id)!;
    expect(tune.tempo).toBe('SLW');
    expect(tune.instrumentA).toBe('P8');

    const name = screen.getByRole('textbox', { name: 'Tune name' });
    await user.clear(name);
    await user.type(name, 'theme');
    expect(byId(world().tunes, id)!.name).toBe('theme');
  });

  it('plays and stops the tune from the picked bar', async () => {
    const user = userEvent.setup();
    const { sound } = await renderTool(Tunes);
    await user.click(screen.getByRole('radio', { name: 'Bar 2' }));
    await user.click(screen.getByRole('checkbox', { name: 'Repeat this bar' }));
    await user.click(screen.getByRole('button', { name: 'Play tune' }));
    expect(sound.playTune).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), expect.anything(), { bar: 1, loopBar: true });
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(sound.stop).toHaveBeenCalled();
  });

  it('puts a blip in the tune', async () => {
    const user = userEvent.setup();
    const { world, creator } = await renderTool(Tunes);
    await user.click(screen.getByRole('button', { name: 'New tune' }));
    const id = creator.editor.getState().tune!;
    await user.click(screen.getByRole('radio', { name: 'Blip' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Blip to play' }), 'pick up key');
    const staff = screen.getByRole('grid', { name: 'Melody, bar 1' });
    fireEvent.pointerDown(within(staff).getByRole('gridcell', { name: 'C at beat 1.1' }));
    fireEvent.pointerUp(window);
    expect(tuneOf(world(), id)!.melody[0]![0]).toEqual({ beats: 1, note: 0, octave: 4, blip: '2' });
  });

  it('deletes a tune after asking, and the room goes quiet', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Tunes);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tune' }), 'tuneful town');
    await user.click(screen.getByRole('button', { name: 'Delete tune' }));
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(byId(world().tunes, '2')).toBeUndefined();
    expect(world().rooms[0]!.tune).toBeUndefined();
  });
});
