import { describe, expect, it } from 'vitest';
import { createWorld, serialize, setDialogText } from '../bitsy';
import { gameFromFile } from './files';
import { exportHtml } from './html';

const world = createWorld({ title: 'Cave <1>' });
setDialogText(world, '0', 'a </script> in dialog');
const data = serialize(world);
const parts = { citsyScript: 'var CitsyModule = function () {};', wasm: new Uint8Array([0, 97, 115, 109, 1]) };

describe('exportHtml', () => {
  it('makes one page with the game, citsy and the player in it', () => {
    const html = exportHtml({ data, title: 'Cave <1>', pageColor: '#102030', size: 'fill', ...parts });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Cave &lt;1&gt;</title>');
    expect(html).toContain('background: #102030');
    expect(html).toContain('var CitsyModule = function () {};');
    expect(html).toContain('AGFzbQE=');
    expect(html).toContain('<script type="text/bitsyGameData" id="exportedGameData">\n');
    expect(html).toContain('citsy_frame');
  });

  it('can be read back in, </script> in dialogs and all', () => {
    const html = exportHtml({ data, title: 'Cave', pageColor: '#000000', size: 'fill', ...parts });
    expect(html.match(/<\/script>/g)!.length).toBe(html.match(/<script/g)!.length);
    expect(gameFromFile('cave.html', html)).toEqual({ title: 'Cave <1>', data });
  });

  it('carries the licence notices for citsy and the Bitsy fonts in it', () => {
    const html = exportHtml({ data, title: 'Cave', pageColor: '#000000', size: 'fill', ...parts });
    const notice = html.slice(html.indexOf('<!--'), html.indexOf('-->'));
    expect(notice).toContain('Copyright (c) 2026 chilichip');
    expect(notice).toContain('Copyright (c) 2016-present, Bitsy authors');
    expect(notice).toContain('Permission is hereby granted, free of charge');
  });

  it('can keep the game at a fixed size', () => {
    const html = exportHtml({ data, title: 'Cave', pageColor: '#000000', size: 512, ...parts });
    expect(html).toContain('--size: 512px');
  });
});
