import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakePlatform } from '../chili-api/fake-platform';
import { bitsyEngine } from '../engines/bitsy';
import { fakeEngine } from '../engines/fake';
import { renderCreator } from '../test/creator';

const engines = [bitsyEngine, { ...fakeEngine, templates: [{ title: 'Example', make: (title: string) => `FAKE\n${title} (example)` }] }];
const both = { engines, enabledEngines: ['bitsy', 'fake'], engine: undefined };

describe('engines in the shell (#59)', () => {
  it('starts on the engine choice, and picking one opens its editor', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    platform.addGame({ title: 'Old Bitsy game' });
    platform.addGame({ title: 'Fake game', data: 'FAKE\nFake game', engine: 'fake' });
    renderCreator({ platform, ...both });
    const choice = await screen.findByRole('region', { name: 'Pick an editor' });
    expect(within(choice).getByText('A test engine.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Tools' })).toBeNull();

    await user.click(within(choice).getByRole('button', { name: /^Fake/ }));
    const tools = await screen.findByRole('navigation', { name: 'Tools' });
    expect(within(tools).getByRole('button', { name: 'Fake tool' })).toBeInTheDocument();
    expect(within(tools).queryByRole('button', { name: 'Room' })).toBeNull();
    // Projects lists only this editor's games.
    const list = await screen.findByRole('list', { name: 'Projects' });
    expect(within(list).getByText('Fake game')).toBeInTheDocument();
    expect(within(list).queryByText('Old Bitsy game')).toBeNull();
  });

  it('makes a game of the open editor with New game, with no second question', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const { creator } = renderCreator({ platform, ...both, engine: 'fake' });
    await screen.findByRole('heading', { name: 'Your games' });
    await user.click(screen.getByRole('button', { name: 'New game' }));
    await screen.findByRole('textbox', { name: 'Game title' });
    expect(platform.games[0]).toMatchObject({ data: 'FAKE\nUntitled game', engine: 'fake' });
    expect(creator.projects.engine()?.id).toBe('fake');
  });

  it('starts a game from an example on the engine choice', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    renderCreator({ platform, ...both });
    const choice = await screen.findByRole('region', { name: 'Pick an editor' });
    await user.click(within(choice).getByRole('button', { name: 'Example' }));
    await screen.findByRole('textbox', { name: 'Game title' });
    expect(platform.games[0]).toMatchObject({ title: 'Example', data: 'FAKE\nExample (example)' });
  });

  it('goes back to the engine choice from an editor, closing the open game', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const fake = platform.addGame({ title: 'Fake game', data: 'FAKE\nFake game', engine: 'fake' });
    const { creator } = renderCreator({ platform, ...both, initialProject: String(fake.id) });
    // A game from the platform opens in its editor at once.
    expect(await within(await screen.findByRole('navigation', { name: 'Tools' })).findByRole('button', { name: 'Fake tool' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change editor' }));
    expect(await screen.findByRole('region', { name: 'Pick an editor' })).toBeInTheDocument();
    expect(creator.projects.getState().open.status).toBe('none');
  });

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
  });
});
