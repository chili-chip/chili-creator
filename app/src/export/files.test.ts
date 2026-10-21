import { describe, expect, it } from 'vitest';
import { createWorld, serialize } from '../bitsy';
import { fileName, gameFromFile } from './files';

const data = serialize(createWorld({ title: 'Mossy "cave"' }));

describe('gameFromFile', () => {
  it('reads a .bitsy file, with its title', () => {
    expect(gameFromFile('cave.bitsy', data)).toEqual({ title: 'Mossy "cave"', data });
  });

  it('reads a game out of a page the classic editor exported, either way it wrote it', () => {
    for (const type of ['bitsyGameData', 'text/bitsyGameData']) {
      const html = `<html><head><script type="${type}" id="exportedGameData">\n${data}\n</script></head></html>`;
      expect(gameFromFile('cave.html', html)).toEqual({ title: 'Mossy "cave"', data: `${data}\n` });
    }
  });

  it('reads the old style of exported page', () => {
    const escaped = data.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const html = `<script>var exportedGameData = "${escaped}";</script>`;
    expect(gameFromFile('old.html', html)).toEqual({ title: 'Mossy "cave"', data });
  });

  it('turns down files with no game in them', () => {
    expect(gameFromFile('notes.txt', 'just some notes')).toEqual({ error: 'notes.txt has no Bitsy game in it.' });
    expect(gameFromFile('page.html', '<html><body>hi</body></html>')).toEqual({ error: 'page.html has no Bitsy game in it.' });
  });

  it('falls back to the file name for an untitled game', () => {
    const untitled = data.replace('Mossy "cave"', '');
    expect(gameFromFile('my-game.bitsy', untitled)).toMatchObject({ title: 'my-game' });
  });
});

describe('fileName', () => {
  it('makes a safe file name from a title', () => {
    expect(fileName('Mossy "cave"!', 'bitsy')).toBe('Mossy cave.bitsy');
    expect(fileName('   ', 'html')).toBe('game.html');
    expect(fileName('a/b\\c:d', 'gif')).toBe('a b c d.gif');
  });
});
