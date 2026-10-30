import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakePlatform } from '../chili-api/fake-platform';
import { bitsyEngine } from '../engines/bitsy';
import { fakeEngine } from '../engines/fake';
import { renderCreator } from '../test/creator';

const engines = [bitsyEngine, fakeEngine];

describe('engines in the shell', () => {
  it('shows the tools of the open game engine', async () => {
    const platform = createFakePlatform();
    const fake = platform.addGame({ title: 'Fake game', data: 'FAKE\nFake game' });
    const { creator } = renderCreator({ platform, engines });
    const tools = screen.getByRole('navigation', { name: 'Tools' });
    expect(within(tools).getByRole('button', { name: 'Room' })).toBeInTheDocument();
    await creator.projects.start();
    await creator.projects.open(String(fake.id));
    expect(await within(tools).findByRole('button', { name: 'Fake tool' })).toBeInTheDocument();
    expect(within(tools).queryByRole('button', { name: 'Room' })).toBeNull();
    expect(within(tools).getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(await screen.findByText('The fake tool')).toBeInTheDocument();
  });

  it('asks which engine a new game uses when more than one is on', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const { creator } = renderCreator({ platform, engines, enabledEngines: ['bitsy', 'fake'] });
    await screen.findByRole('heading', { name: 'Your games' });
    await user.click(screen.getByRole('button', { name: 'New game' }));
    const picker = screen.getByRole('group', { name: 'Pick an engine' });
    expect(within(picker).getByText('A test engine.')).toBeInTheDocument();
    await user.click(within(picker).getByRole('button', { name: /Fake/ }));
    expect(await within(screen.getByRole('navigation', { name: 'Tools' })).findByRole('button', { name: 'Fake tool' })).toBeInTheDocument();
    expect(platform.games[0]!.data).toBe('FAKE\nUntitled game');
    expect(creator.projects.engine()?.id).toBe('fake');
  });

  it('starts a game from an engine template', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const withTemplate = { ...fakeEngine, templates: [{ title: 'Example', make: (title: string) => `FAKE\n${title} (example)` }] };
    renderCreator({ platform, engines: [bitsyEngine, withTemplate], enabledEngines: ['bitsy', 'fake'] });
    await screen.findByRole('heading', { name: 'Your games' });
    await user.click(screen.getByRole('button', { name: 'New game' }));
    await user.click(within(screen.getByRole('group', { name: 'Pick an engine' })).getByRole('button', { name: 'Example' }));
    await screen.findByRole('textbox', { name: 'Game title' });
    expect(platform.games[0]).toMatchObject({ title: 'Example', data: 'FAKE\nExample (example)' });
  });

  it('makes a Bitsy game at once when Bitsy is the only engine on', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    renderCreator({ platform, engines });
    await screen.findByRole('heading', { name: 'Your games' });
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.queryByRole('group', { name: 'Pick an engine' })).toBeNull();
    await screen.findByRole('textbox', { name: 'Game title' });
    expect(platform.games[0]!.data).toContain('# BITSY VERSION');
  });

  it('shows an engine badge on games the platform marks with another engine', async () => {
    const platform = createFakePlatform();
    platform.addGame({ title: 'Bee Home', data: 'FAKE\nBee Home', engine: 'fake' });
    renderCreator({ platform, engines });
    const row = (await screen.findByText('Bee Home')).closest('li')!;
    expect(within(row).getByText('Fake')).toBeInTheDocument();
  });
});
