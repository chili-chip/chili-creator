import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTool } from '../../test/creator';
import download from '.';

const files = vi.hoisted(() => ({ saved: [] as { name: string; content: unknown; type: string }[] }));

vi.mock('../../export/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../export/files')>()),
  download: (name: string, content: unknown, type: string) => files.saved.push({ name, content, type }),
}));

vi.mock('../../export/html', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../export/html')>()),
  loadHtmlParts: async () => ({ citsyScript: 'var CitsyModule;', wasm: new Uint8Array([1, 2, 3]) }),
}));

const Download = download.component;

beforeEach(() => {
  files.saved = [];
});

describe('Download', () => {
  it('downloads the game as a .bitsy file', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Download);
    await user.click(screen.getByRole('button', { name: 'Download .bitsy' }));
    expect(files.saved).toEqual([{ name: 'Test game.bitsy', content: creator.projects.data(), type: 'text/plain' }]);
  });

  it('downloads a web page that plays the game, in the colour and size picked', async () => {
    const user = userEvent.setup();
    await renderTool(Download);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Size' }), '512');
    await user.click(screen.getByRole('button', { name: 'Download web page' }));
    await waitFor(() => expect(files.saved).toHaveLength(1));
    const [page] = files.saved;
    expect(page!.name).toBe('Test game.html');
    expect(page!.type).toBe('text/html');
    expect(page!.content).toContain('<title>Test game</title>');
    expect(page!.content).toContain('--size: 512px');
    expect(page!.content).toContain('AQID');
  });

  it('makes the page any size', async () => {
    const user = userEvent.setup();
    await renderTool(Download);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Size' }), 'Other size');
    const pixels = screen.getByRole('spinbutton', { name: 'Size in pixels' });
    await user.clear(pixels);
    await user.type(pixels, '700');
    await user.click(screen.getByRole('button', { name: 'Download web page' }));
    await waitFor(() => expect(files.saved).toHaveLength(1));
    expect(files.saved[0]!.content).toContain('--size: 700px');
  });
});
