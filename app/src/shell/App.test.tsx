import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakePlatform } from '../chili-api/fake-platform';
import { blankGame, renderCreator } from '../test/creator';

const game = (title: string) => `${title}\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n`;

describe('App', () => {
  it('switches language from the status bar and remembers it', async () => {
    const user = userEvent.setup();
    const catalogs: Record<string, Record<string, string>> = { pl: { Room: 'Pokój', 'Your games': 'Twoje gry', Help: 'Pomoc' } };
    const first = renderCreator({ loadCatalog: async (id) => catalogs[id] ?? {} });
    await screen.findByRole('heading', { name: 'Your games' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'Polski');
    const tools = screen.getByRole('navigation', { name: 'Tools' });
    expect(await within(tools).findByRole('button', { name: 'Pokój' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Twoje gry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pomoc' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pl');
    first.unmount();
    renderCreator({ loadCatalog: async (id) => catalogs[id] ?? {} });
    expect(await screen.findByRole('heading', { name: 'Twoje gry' })).toBeInTheDocument();
    localStorage.removeItem('chili.creator.language');
  });

  it('shows the creator frame with a launcher for every registered tool', async () => {
    renderCreator();
    expect(screen.getByRole('banner')).toHaveTextContent('Chili Creator');
    const tools = screen.getByRole('navigation', { name: 'Tools' });
    expect(within(tools).getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(within(tools).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    for (const name of ['Room', 'Paint', 'Library', 'Colors', 'Dialog', 'Exits & endings', 'Variables', 'Problems', 'Game', 'Find']) {
      expect(within(tools).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('shows who is signed in', async () => {
    renderCreator();
    expect(await screen.findByText('Kacper')).toBeInTheDocument();
  });

  it('says so when nobody is signed in', async () => {
    renderCreator({ signedIn: false });
    expect(await screen.findByText('Not signed in')).toBeInTheDocument();
  });

  it('offers the classic editor while the new one is in preview', async () => {
    renderCreator();
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Classic editor' })).toHaveAttribute(
      'href',
      expect.stringContaining('../editor/index.html'),
    );
  });

  it('opens the command palette with Ctrl+K and runs a command from it', async () => {
    const user = userEvent.setup();
    renderCreator();
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Commands' });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Reset layout/ }));
    expect(screen.queryByRole('dialog', { name: 'Commands' })).not.toBeInTheDocument();
  });

  it('renames the open game and shows the save state', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { creator } = renderCreator({ platform, initialProject: String(saved.id) });
    const title = await screen.findByRole('textbox', { name: 'Game title' });
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Saved');
    await user.clear(title);
    await user.type(title, 'Moss');
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Saving');
    await act(() => creator.projects.flush());
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Saved');
    expect(platform.games[0]!.title).toBe('Moss');
  });

  it('offers to retry a failed save', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { creator } = renderCreator({ platform, initialProject: String(saved.id) });
    const title = await screen.findByRole('textbox', { name: 'Game title' });
    platform.failNext();
    await user.type(title, '!');
    await act(() => creator.projects.flush().catch(() => {}));
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Not saved');
    await user.click(screen.getByRole('button', { name: 'Retry saving' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(platform.games[0]!.title).toBe('Mossland!');
  });

  it('opens the project from the URL', async () => {
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    renderCreator({ platform, initialProject: String(saved.id) });
    expect(await screen.findByRole('textbox', { name: 'Game title' })).toHaveValue('Mossland');
  });

  it('brings the room to the front when a game opens', async () => {
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Test game', data: blankGame });
    renderCreator({ platform, initialProject: String(saved.id) });
    expect(await screen.findByRole('application', { name: 'Room example room' })).toBeInTheDocument();
    expect(screen.getByRole('application', { name: 'Drawing avatar' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Sprites' })).toBeInTheDocument();
  });

  it('counts the game’s problems in the status bar and opens them', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Test game', data: blankGame });
    renderCreator({ platform, initialProject: String(saved.id) });
    const status = await screen.findByRole('button', { name: 'Problems: 1 warning' });
    await user.click(status);
    expect(await screen.findByText('Players cannot finish this game yet: add an ending.')).toBeInTheDocument();
  });

  it('shows the dashboard first when no game is open', async () => {
    renderCreator();
    expect(await screen.findByRole('heading', { name: 'Your games' })).toBeInTheDocument();
  });

  it('goes back to the dashboard when the open game is closed', async () => {
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Test game', data: blankGame });
    const { creator } = renderCreator({ platform, initialProject: String(saved.id) });
    await screen.findByRole('application', { name: 'Room example room' });
    await act(() => creator.projects.close());
    expect(await screen.findByRole('heading', { name: 'Your games' })).toBeInTheDocument();
  });

  it('undoes and redoes from the top bar', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Test game', data: blankGame });
    renderCreator({ platform, initialProject: String(saved.id) });
    const title = await screen.findByRole('textbox', { name: 'Game title' });
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(undo).toBeDisabled();
    await user.type(title, '!');
    expect(undo).toBeEnabled();
    await user.click(undo);
    expect(title).toHaveValue('Test game');
    expect(redo).toBeEnabled();
    await user.click(redo);
    expect(title).toHaveValue('Test game!');
  });

  it('undoes with Ctrl+Z outside text fields', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Test game', data: blankGame });
    renderCreator({ platform, initialProject: String(saved.id) });
    const title = await screen.findByRole('textbox', { name: 'Game title' });
    await user.type(title, '!');
    act(() => title.blur());
    await user.keyboard('{Control>}z{/Control}');
    expect(title).toHaveValue('Test game');
  });

  it('offers the layout presets as commands and in the status bar', async () => {
    const user = userEvent.setup();
    renderCreator();
    expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveDisplayValue('Choose a layout');
    await user.keyboard('{Control>}k{/Control}');
    for (const name of ['Everything', 'Drawing', 'Writing', 'Sound', 'Playtest']) {
      expect(screen.getByRole('option', { name: new RegExp(`Layout: ${name}`) })).toBeInTheDocument();
    }
  });
});

/** Makes the creator think it is on a phone-sized screen. */
function onPhone() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe('App on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows one tool at a time, picked from the tool bar at the bottom', async () => {
    const user = userEvent.setup();
    onPhone();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Test game', data: blankGame });
    renderCreator({ platform, initialProject: String(saved.id) });
    const tools = screen.getByRole('navigation', { name: 'Tools' });
    expect(await screen.findByRole('application', { name: 'Room example room' })).toBeInTheDocument();
    expect(within(tools).getByRole('button', { name: 'Room' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('application', { name: 'Drawing avatar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Layout' })).not.toBeInTheDocument();

    await user.click(within(tools).getByRole('button', { name: 'Paint' }));
    expect(screen.getByRole('application', { name: 'Drawing avatar' })).toBeVisible();
    expect(screen.getByRole('application', { name: 'Room example room', hidden: true })).not.toBeVisible();
    expect(within(tools).getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens tools from commands too, like the problem count', async () => {
    const user = userEvent.setup();
    onPhone();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Test game', data: blankGame });
    renderCreator({ platform, initialProject: String(saved.id) });
    await user.click(await screen.findByRole('button', { name: 'Problems: 1 warning' }));
    expect(await screen.findByText('Players cannot finish this game yet: add an ending.')).toBeVisible();
  });
});
