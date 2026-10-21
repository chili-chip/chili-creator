import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { blipOf, byId } from '../../bitsy';
import { renderTool } from '../../test/creator';
import blips from '.';

const Blips = blips.component;

describe('Blips', () => {
  it('shows the first blip and who makes it, and plays it', async () => {
    const user = userEvent.setup();
    const { sound } = await renderTool(Blips);
    expect(screen.getByRole('combobox', { name: 'Blip' })).toHaveDisplayValue('meow');
    expect(screen.getByRole('combobox', { name: 'Pitch 1' })).toHaveDisplayValue('E5');
    expect(screen.getByRole('spinbutton', { name: 'Attack (ms)' })).toHaveValue(40);
    expect(screen.getByText('Made by cat')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play blip' }));
    expect(sound.playBlip).toHaveBeenCalledWith(expect.objectContaining({ id: '1', name: 'meow' }));
  });

  it('makes a new blip of a kind and plays it', async () => {
    const user = userEvent.setup();
    const { world, creator, sound } = await renderTool(Blips);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kind' }), 'bloop');
    await user.click(screen.getByRole('button', { name: 'New blip' }));
    expect(creator.editor.getState().blip).toBe('3');
    const blip = blipOf(world(), '3')!;
    expect(blip.name).toBe('bloop 3');
    expect(blip.pitches[0]!.octave).toBe(2);
    expect(sound.playBlip).toHaveBeenLastCalledWith(expect.objectContaining({ id: '3' }));
    expect(screen.getByRole('combobox', { name: 'Blip' })).toHaveDisplayValue('bloop 3');
  });

  it('remakes the sound, nudges it and changes the details', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Blips);
    const before = byId(world().blips, '1')!.lines.join('\n');
    await user.click(screen.getByRole('button', { name: 'Make a new sound' }));
    expect(byId(world().blips, '1')!.lines.join('\n')).not.toBe(before);
    expect(byId(world().blips, '1')!.name).toBe('meow');
    const made = byId(world().blips, '1')!.lines.join('\n');
    await user.click(screen.getByRole('button', { name: 'Mutate' }));
    expect(byId(world().blips, '1')!.lines.join('\n')).not.toBe(made);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Pitch 1' }), 'A4');
    await user.click(screen.getByRole('button', { name: 'Higher' }));
    expect(blipOf(world(), '1')!.pitches[0]).toEqual({ beats: 1, note: 10, octave: 4 });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pitch 3' }), 'None');
    expect(blipOf(world(), '1')!.pitches[2]!.beats).toBe(0);

    const length = screen.getByRole('spinbutton', { name: 'Length (ms)' });
    await user.clear(length);
    await user.type(length, '200');
    expect(blipOf(world(), '1')!.envelope.length).toBe(200);
    await user.click(screen.getByRole('radio', { name: 'Thin' }));
    await user.click(screen.getByRole('checkbox', { name: 'Repeat the pitches' }));
    expect(blipOf(world(), '1')!.instrument).toBe('P4');
    expect(blipOf(world(), '1')!.repeat).toBe(true);
  });

  it('deletes a blip after asking, and the cat goes quiet', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Blips);
    await user.click(screen.getByRole('button', { name: 'Delete blip' }));
    expect(screen.getByText(/Delete “meow”/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(byId(world().blips, '1')).toBeUndefined();
    expect(byId(world().sprites, 'a')!.blip).toBeUndefined();
  });
});
