import { describe, expect, it } from 'vitest';
import { parse } from '.';
import { parseScript, printScript, renameVariableInScript, scriptBody, scriptReferences, toScript, type ScriptNode } from './script';

const fixtures = import.meta.glob<string>('./fixtures/*.bitsy', { query: '?raw', import: 'default', eager: true });
const fixture = (name: string) => parse(fixtures[`./fixtures/${name}.bitsy`]!).world;

describe('scriptBody and toScript', () => {
  it('takes the """ wrapper off and puts it back when there is more than one line', () => {
    expect(scriptBody('I am a cat')).toBe('I am a cat');
    expect(scriptBody('"""\nline one\n\nline two\n"""')).toBe('line one\n\nline two');
    expect(toScript('I am a cat')).toBe('I am a cat');
    expect(toScript('line one\n\nline two')).toBe('"""\nline one\n\nline two\n"""');
    expect(toScript('')).toBe('');
  });
});

describe('parseScript', () => {
  it('reads text, effects and calls', () => {
    expect(parseScript('A key! {wvy}What does it open?{wvy} {end}')).toEqual([
      { type: 'text', text: 'A key! ' },
      { type: 'effect', name: 'wvy' },
      { type: 'text', text: 'What does it open?' },
      { type: 'effect', name: 'wvy' },
      { type: 'text', text: ' ' },
      { type: 'call', name: 'end', args: [] },
    ]);
    expect(parseScript('{exit "1" 3 4}{item "key"}')).toEqual([
      { type: 'call', name: 'exit', args: ['"1"', '3', '4'] },
      { type: 'call', name: 'item', args: ['"key"'] },
    ]);
  });

  it('reads assignments, also inside a code block', () => {
    expect(parseScript('{\n  {got_key = 1}\n}\n"A shiny key."')).toEqual([
      { type: 'assign', variable: 'got_key', expression: '1' },
      { type: 'text', text: '\n"A shiny key."' },
    ]);
  });

  it('reads sequences, cycles and shuffles with an option per dash', () => {
    const [node] = parseScript('{cycle\n  - one\n  - two\n    and more\n}');
    expect(node).toEqual({
      type: 'list',
      kind: 'cycle',
      options: [[{ type: 'text', text: 'one' }], [{ type: 'text', text: 'two\nand more' }]],
    });
  });

  it('reads conditionals, with nested calls in the condition', () => {
    const [node] = parseScript('{\n  - {item "Spores"} < 6 ?\n    water them\n  - else ?\n    thanks\n}');
    expect(node).toEqual({
      type: 'branch',
      cases: [
        { condition: '{item "Spores"} < 6', body: [{ type: 'text', text: 'water them' }] },
        { condition: 'else', body: [{ type: 'text', text: 'thanks' }] },
      ],
    });
  });

  it('reads every dialog of mossland without losing a block', () => {
    const world = fixture('mossland');
    const [sequence] = parseScript(world.dialogs.find((d) => d.id === 'SPR_1')!.script);
    expect(sequence).toMatchObject({ type: 'list', kind: 'sequence' });
    const options = (sequence as { options: unknown[][] }).options;
    expect(options).toHaveLength(5);
    expect(options[4]![0]).toMatchObject({ type: 'branch' });
  });
});

describe('scriptReferences', () => {
  it('lists the variables, items and rooms a script uses, and whether it ends the game', () => {
    const refs = scriptReferences(
      '"""\n{a = a + 1}\n{\n  - {item "Spores"} < b ?\n    {exit "2" 3 4}\n  - else ?\n    {end}\n}\n{say c}{printItem "0"}\n"""',
    );
    expect([...refs.variables].sort()).toEqual(['a', 'b', 'c']);
    expect([...refs.assigned]).toEqual(['a']);
    expect([...refs.items].sort()).toEqual(['0', 'Spores']);
    expect([...refs.rooms]).toEqual(['2']);
    expect(refs.endsGame).toBe(true);
  });

  it('does not take words in text or quotes for variables', () => {
    const refs = scriptReferences('{sequence\n  - moss is nice\n}{say "moss"}{x = true}');
    expect([...refs.variables]).toEqual(['x']);
  });
});

describe('renameVariableInScript', () => {
  it('renames the variable in code and nowhere else', () => {
    const script = '"""\n{moss = moss + 1}\n{\n  - moss > 2 ?\n    so much moss\n}\n{say "moss"}{say moss}\n"""';
    expect(renameVariableInScript(script, 'moss', 'spores')).toBe(
      '"""\n{spores = spores + 1}\n{\n  - spores > 2 ?\n    so much moss\n}\n{say "moss"}{say spores}\n"""',
    );
  });

  it('leaves names that only start the same alone', () => {
    expect(renameVariableInScript('{a = ab + a}', 'a', 'z')).toBe('{z = ab + z}');
  });
});

describe('printScript', () => {
  it('writes blocks back as Bitsy script', () => {
    const nodes: ScriptNode[] = [
      { type: 'text', text: 'hi ' },
      { type: 'effect', name: 'wvy' },
      { type: 'text', text: 'there' },
      { type: 'effect', name: 'wvy' },
      { type: 'call', name: 'pg', args: [] },
      { type: 'assign', variable: 'a', expression: 'a + 1' },
      { type: 'list', kind: 'cycle', options: [[{ type: 'text', text: 'one' }], [{ type: 'text', text: 'two\nlines' }]] },
      {
        type: 'branch',
        cases: [
          { condition: '{item "1"} >= 1', body: [{ type: 'call', name: 'property', args: ['locked', 'false'] }] },
          { condition: 'else', body: [{ type: 'text', text: 'locked' }] },
        ],
      },
    ];
    const script = printScript(nodes);
    expect(script).toBe(
      'hi {wvy}there{wvy}{pg}{a = a + 1}{cycle\n  - one\n  - two\n    lines\n}{\n  - {item "1"} >= 1 ?\n    {property locked false}\n  - else ?\n    locked\n}',
    );
    expect(parseScript(script)).toEqual(nodes);
  });

  it('indents lists inside lists', () => {
    const nodes: ScriptNode[] = [
      { type: 'list', kind: 'sequence', options: [[{ type: 'list', kind: 'shuffle', options: [[{ type: 'text', text: 'a' }]] }]] },
    ];
    expect(printScript(nodes)).toBe('{sequence\n  - {shuffle\n      - a\n    }\n}');
    expect(parseScript(printScript(nodes))).toEqual(nodes);
  });

  it('round-trips every dialog in the fixtures to the same blocks', () => {
    for (const [name, text] of Object.entries(fixtures)) {
      for (const dialog of parse(text).world.dialogs) {
        const nodes = parseScript(dialog.script);
        expect(parseScript(toScript(printScript(nodes))), `${name} dialog ${dialog.id}`).toEqual(nodes);
      }
    }
  });
});
