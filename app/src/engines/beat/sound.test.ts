import { describe, expect, it } from 'vitest';
import { blankGame, parseGame } from './model';
import { addBlip, addTune, previewGame, renameBlip, renameTune, setStep } from './sound';

const blank = () => parseGame(blankGame('Test')).doc;

describe('Chili Beat sounds', () => {
  it('adds blips and tunes with free ids', () => {
    const game = blank();
    expect(addBlip(game)).toEqual({ id: 'blip-1', preset: 'blip', pitch: 4, length: 3, slide: 0 });
    expect(addBlip(game).id).toBe('blip-2');
    const tune = addTune(game);
    expect(tune).toMatchObject({ id: 'tune-1', scale: 'major' });
    expect(tune.lead).toEqual(Array(16).fill(0));
  });

  it('sets a step, and clicking the same note again makes it a rest', () => {
    const game = blank();
    addTune(game);
    setStep(game, 'tune-1', 'lead', 3, 5);
    expect(game.tunes![0]!.lead[3]).toBe(5);
    setStep(game, 'tune-1', 'lead', 3, 5);
    expect(game.tunes![0]!.lead[3]).toBe(0);
  });

  it('renames a blip or tune everywhere it is used', () => {
    const game = blank();
    addBlip(game);
    addTune(game);
    game.rules.push({ when: { press: 'a' }, do: [{ sound: 'blip-1' }] });
    game.screens[0]!.tune = 'tune-1';
    renameBlip(game, 'blip-1', 'coin');
    renameTune(game, 'tune-1', 'main');
    expect(game.rules[1]!.do[0]).toEqual({ sound: 'coin' });
    expect(game.screens[0]!.tune).toBe('main');
  });

  it('makes a tiny game that plays one blip or one tune, for previews', () => {
    const game = blank();
    addBlip(game);
    addTune(game);
    const blip = JSON.parse(previewGame(game, { blip: 'blip-1' }));
    expect(blip.rules).toEqual([{ when: { start: true }, do: [{ sound: 'blip-1' }] }]);
    const tune = JSON.parse(previewGame(game, { tune: 'tune-1' }));
    expect(tune.screens[0].tune).toBe('tune-1');
    expect(tune.tempo).toBe(game.tempo);
  });
});
