import { describe, expect, it } from 'vitest';
import { checkInput, type JsonSchema } from './schema';

const schema: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'A name.' },
    count: { type: 'integer', minimum: 0, maximum: 3 },
    kind: { type: 'string', enum: ['tiles', 'sprites'] },
    rows: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
    cover: { type: ['string', 'null'] },
    rule: { type: 'object' },
  },
  required: ['name'],
};

describe('checkInput', () => {
  it('accepts input that fits', () => {
    expect(checkInput(schema, { name: 'a', count: 2, kind: 'tiles', rows: ['x'], cover: null, rule: { any: 1 } })).toBeNull();
  });

  it('names the missing field', () => {
    expect(checkInput(schema, {})).toBe('input.name is required.');
  });

  it('refuses fields it does not know, so typos show', () => {
    expect(checkInput(schema, { name: 'a', nmae: 'b' })).toBe('input.nmae is not a known field. Known fields: name, count, kind, rows, cover, rule.');
  });

  it('checks types, whole numbers and ranges', () => {
    expect(checkInput(schema, { name: 3 })).toBe('input.name must be a string.');
    expect(checkInput(schema, { name: 'a', count: 1.5 })).toBe('input.count must be a whole number.');
    expect(checkInput(schema, { name: 'a', count: 4 })).toBe('input.count must be at most 3.');
    expect(checkInput(schema, { name: 'a', count: -1 })).toBe('input.count must be at least 0.');
    expect(checkInput(schema, { name: 'a', cover: 1 })).toBe('input.cover must be a string or null.');
  });

  it('checks enums and arrays item by item', () => {
    expect(checkInput(schema, { name: 'a', kind: 'rooms' })).toBe('input.kind must be one of: tiles, sprites.');
    expect(checkInput(schema, { name: 'a', rows: [1] })).toBe('input.rows[0] must be a string.');
    expect(checkInput(schema, { name: 'a', rows: [] })).toBe('input.rows must have at least 1 items.');
    expect(checkInput(schema, { name: 'a', rows: ['a', 'b', 'c'] })).toBe('input.rows must have at most 2 items.');
  });

  it('lets null through a nullable enum', () => {
    expect(checkInput({ type: ['string', 'null'], enum: ['a'] }, null)).toBeNull();
    expect(checkInput({ type: 'string', enum: ['a'] }, null)).toBe('input must be a string.');
  });

  it('treats a missing input as an empty object', () => {
    expect(checkInput({ type: 'object', properties: {} }, undefined)).toBeNull();
  });
});
