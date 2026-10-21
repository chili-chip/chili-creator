// Bitsy dialog scripts: text with `{…}` blocks for effects, calls,
// variables, sequences and conditionals. This reads them well enough for
// the editor (the block view, references and validators). citsy runs them.

export type ListKind = 'sequence' | 'cycle' | 'shuffle';

export type ScriptNode =
  | { type: 'text'; text: string }
  | { type: 'effect'; name: string }
  | { type: 'call'; name: string; args: string[] }
  | { type: 'assign'; variable: string; expression: string }
  | { type: 'list'; kind: ListKind; options: ScriptNode[][] }
  | { type: 'branch'; cases: { condition: string; body: ScriptNode[] }[] };

/** Text effects that toggle on and off, like `{wvy}`. */
export const effects = ['wvy', 'shk', 'rbw', 'clr1', 'clr2', 'clr3'] as const;

const listKinds: readonly string[] = ['sequence', 'cycle', 'shuffle'];
const keywords = new Set(['true', 'false', 'else']);
/** Calls whose arguments are expressions, so a bare word is a variable. */
const expressionCalls = new Set(['say', 'print']);

const wrapped = /^"""\r?\n([\s\S]*?)\r?\n"""$/;

/** The script without its `"""` wrapper. */
export function scriptBody(script: string): string {
  return wrapped.exec(script)?.[1] ?? script;
}

/** A script for the file: more than one line needs the `"""` wrapper. */
export function toScript(body: string): string {
  return body.includes('\n') ? `"""\n${body}\n"""` : body;
}

function bodyRange(script: string): [number, number] {
  const match = wrapped.exec(script);
  if (!match) return [0, script.length];
  const start = script.indexOf('\n') + 1;
  return [start, start + match[1]!.length];
}

/** Walks `src` from `from`, calling `visit` for each character outside strings, with the brace depth. */
function scan(src: string, from: number, to: number, visit: (i: number, depth: number) => boolean | void): void {
  let depth = 0;
  let quoted = false;
  for (let i = from; i < to; i++) {
    const c = src[i];
    if (c === '"' && src[i - 1] !== '\\') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (visit(i, depth)) return;
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
}

function matchingBrace(src: string, open: number, end: number): number {
  let found = -1;
  scan(src, open, end, (i, depth) => {
    if (src[i] === '}' && depth === 1) {
      found = i;
      return true;
    }
  });
  return found;
}

function splitArgs(text: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"' && text[i - 1] !== '\\') quoted = !quoted;
    else if (!quoted && c === '{') depth++;
    else if (!quoted && c === '}') depth--;
    if (!quoted && depth === 0 && /[\s,]/.test(c)) {
      if (current) args.push(current);
      current = '';
    } else current += c;
  }
  if (current) args.push(current);
  return args;
}

function unquote(text: string): string {
  return text.length >= 2 && text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1) : text;
}

/** Text in an option is written indented; the block view wants it plain. */
function tidy(nodes: ScriptNode[]): ScriptNode[] {
  const out: ScriptNode[] = [];
  nodes.forEach((node, index) => {
    if (node.type !== 'text') {
      out.push(node);
      return;
    }
    let text = node.text
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
    if (index === 0) text = text.replace(/^\s+/, '');
    if (index === nodes.length - 1) text = text.replace(/\s+$/, '');
    if (text) out.push({ type: 'text', text });
  });
  return out;
}

class Parser {
  /** Where code is in the source, for renaming variables. */
  readonly code: [number, number][] = [];

  constructor(readonly src: string) {}

  body(start: number, end: number): ScriptNode[] {
    const nodes: ScriptNode[] = [];
    let text = '';
    let i = start;
    while (i < end) {
      if (this.src[i] === '{') {
        const close = matchingBrace(this.src, i, end);
        if (close >= 0) {
          if (text) nodes.push({ type: 'text', text });
          text = '';
          nodes.push(...this.block(i + 1, close));
          i = close + 1;
          continue;
        }
      }
      text += this.src[i];
      i++;
    }
    if (text) nodes.push({ type: 'text', text });
    return nodes;
  }

  /** Where each `-` option of a list or conditional starts and ends. */
  options(start: number, end: number): [number, number][] {
    const starts: number[] = [];
    let lineStart = true;
    scan(this.src, start, end, (i, depth) => {
      const c = this.src[i]!;
      if (c === '\n') lineStart = true;
      else if (c === '-' && depth === 0 && lineStart && /\s/.test(this.src[i + 1] ?? ' ')) starts.push(i);
      else if (!/\s/.test(c)) lineStart = false;
    });
    return starts.map((s, n) => [s + 1, n + 1 < starts.length ? starts[n + 1]! : end]);
  }

  block(start: number, end: number): ScriptNode[] {
    const inner = this.src.slice(start, end);
    const lead = inner.length - inner.trimStart().length;
    const first = start + lead;
    const keyword = /^[A-Za-z_]\w*/.exec(inner.slice(lead))?.[0] ?? '';

    if (listKinds.includes(keyword)) {
      const options = this.options(first + keyword.length, end).map(([s, e]) => tidy(this.body(s, e)));
      return [{ type: 'list', kind: keyword as ListKind, options }];
    }
    if (this.src[first] === '-') {
      const cases = this.options(first, end).map(([s, e]) => {
        let question = -1;
        scan(this.src, s, e, (i, depth) => {
          if (this.src[i] === '?' && depth === 0) {
            question = i;
            return true;
          }
        });
        if (question < 0) return { condition: '', body: tidy(this.body(s, e)) };
        this.code.push([s, question]);
        return { condition: this.src.slice(s, question).trim(), body: tidy(this.body(question + 1, e)) };
      });
      return [{ type: 'branch', cases }];
    }
    if (this.src[first] === '{') {
      return this.body(start, end).filter((node) => node.type !== 'text' || node.text.trim() !== '');
    }
    const assign = /^\s*([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]*?)\s*$/.exec(inner);
    if (assign) {
      this.code.push([start, end]);
      return [{ type: 'assign', variable: assign[1]!, expression: assign[2]! }];
    }
    if (!keyword) return inner.trim() ? [{ type: 'text', text: `{${inner}}` }] : [];
    const rest = inner.slice(lead + keyword.length);
    const args = splitArgs(rest);
    if (!args.length && (effects as readonly string[]).includes(keyword)) return [{ type: 'effect', name: keyword }];
    this.code.push([first + keyword.length, end]);
    return [{ type: 'call', name: keyword, args }];
  }
}

function parseWithCode(script: string) {
  const parser = new Parser(script);
  const [start, end] = bodyRange(script);
  return { nodes: parser.body(start, end), code: parser.code };
}

/** The blocks of a script, as the block view shows them. */
export function parseScript(script: string): ScriptNode[] {
  return parseWithCode(script).nodes;
}

export interface ScriptReferences {
  /** Variables read or set. */
  variables: Set<string>;
  /** Variables set. */
  assigned: Set<string>;
  /** Items by id or name, from `{item}` and `{printItem}`. */
  items: Set<string>;
  /** Rooms by id or name, from `{exit}`. */
  rooms: Set<string>;
  /** Has an `{end}`. */
  endsGame: boolean;
}

/** What a script uses, for finding references and checking them. */
export function scriptReferences(script: string): ScriptReferences {
  const refs: ScriptReferences = {
    variables: new Set(),
    assigned: new Set(),
    items: new Set(),
    rooms: new Set(),
    endsGame: false,
  };

  function expression(text: string) {
    // Calls inside an expression, like `{item "key"} > 0`.
    walk(parseScript(text).filter((node) => node.type !== 'text'));
    const bare = text.replace(/\{[^{}]*\}/g, ' ').replace(/"[^"]*"/g, ' ');
    for (const word of bare.match(/[A-Za-z_]\w*/g) ?? []) {
      if (!keywords.has(word)) refs.variables.add(word);
    }
  }

  function walk(nodes: ScriptNode[]) {
    for (const node of nodes) {
      if (node.type === 'assign') {
        refs.variables.add(node.variable);
        refs.assigned.add(node.variable);
        expression(node.expression);
      } else if (node.type === 'call') {
        const first = node.args[0];
        if ((node.name === 'item' || node.name === 'printItem') && first) refs.items.add(unquote(first));
        else if (node.name === 'exit' && first) refs.rooms.add(unquote(first));
        else if (node.name === 'end') refs.endsGame = true;
        else if (expressionCalls.has(node.name)) node.args.forEach(expression);
      } else if (node.type === 'list') {
        node.options.forEach(walk);
      } else if (node.type === 'branch') {
        for (const { condition, body } of node.cases) {
          expression(condition);
          walk(body);
        }
      }
    }
  }

  walk(parseScript(script));
  return refs;
}

/** Renames a variable where the script reads or sets it; text and quotes stay as they are. */
export function renameVariableInScript(script: string, from: string, to: string): string {
  const { code } = parseWithCode(script);
  const edits: [number, number][] = [];
  for (const [start, end] of code) {
    let quoted = false;
    for (let i = start; i < end; i++) {
      const c = script[i]!;
      if (c === '"' && script[i - 1] !== '\\') quoted = !quoted;
      if (quoted || !/[A-Za-z_]/.test(c) || /\w/.test(script[i - 1] ?? '')) continue;
      const word = /^[A-Za-z_]\w*/.exec(script.slice(i, end))![0];
      if (word === from) edits.push([i, i + word.length]);
      i += word.length - 1;
    }
  }
  let out = script;
  for (const [start, end] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + to + out.slice(end);
  return out;
}
