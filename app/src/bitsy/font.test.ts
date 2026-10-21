import { describe, expect, it } from 'vitest';
import { createWorld, parse, serialize } from '.';
import { fontFile, readFontFile, setCustomFont } from './font';

const file = 'FONT tiny\nSIZE 3 4\nCHAR 65\n010\n101\n111\n101\n\n';

describe('custom fonts', () => {
  it('reads a .bitsyfont file', () => {
    expect(readFontFile(file)).toEqual({ id: 'tiny', lines: ['SIZE 3 4', 'CHAR 65', '010', '101', '111', '101'] });
    expect(readFontFile('not a font')).toBeNull();
  });

  it('puts the font in the game and makes it the default, as the classic editor does', () => {
    const world = createWorld({ title: 'a' });
    setCustomFont(world, readFontFile(file)!);
    expect(world.defaultFont).toBe('tiny');
    const data = serialize(world);
    expect(data).toContain('DEFAULT_FONT tiny');
    expect(data).toContain('FONT tiny\nSIZE 3 4\nCHAR 65\n010');
    expect(parse(data).world.fonts).toEqual(world.fonts);
  });

  it('replaces an earlier custom font', () => {
    const world = createWorld({ title: 'a' });
    setCustomFont(world, readFontFile(file)!);
    setCustomFont(world, readFontFile(file.replace('tiny', 'other'))!);
    expect(world.fonts.map((f) => f.id)).toEqual(['other']);
  });

  it('writes the game\'s font back out as a file', () => {
    const world = createWorld({ title: 'a' });
    expect(fontFile(world)).toBeNull();
    setCustomFont(world, readFontFile(file)!);
    expect(fontFile(world)).toBe('FONT tiny\nSIZE 3 4\nCHAR 65\n010\n101\n111\n101\n');
  });
});
