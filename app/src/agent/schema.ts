// The small part of JSON Schema the agent tools use. Agents send it to the
// model as the tool's input shape, and `checkInput` checks what comes back,
// so a tool's code only sees input that fits.

type TypeName = 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null';

export interface JsonSchema {
  type?: TypeName | TypeName[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: readonly (string | number)[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

function typeOf(value: unknown): TypeName | 'other' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  return type === 'string' || type === 'number' || type === 'boolean' || type === 'object' ? type : 'other';
}

function fits(value: unknown, type: TypeName): boolean {
  const actual = typeOf(value);
  if (type === 'integer' || type === 'number') return actual === 'number' && Number.isFinite(value);
  return actual === type;
}

const article = (type: TypeName) => (type === 'integer' || type === 'array' || type === 'object' ? 'an' : 'a');
const typeName = (type: TypeName) => (type === 'null' ? 'null' : `${article(type)} ${type === 'integer' ? 'whole number' : type}`);

/** What is wrong with `value`, in one sentence, or null when it fits. Objects refuse fields they do not list. */
export function checkInput(schema: JsonSchema, value: unknown, path = 'input'): string | null {
  if (path === 'input' && value === undefined) value = {};
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length > 0 && !types.some((type) => fits(value, type))) {
    return `${path} must be ${types.map(typeName).join(' or ')}.`;
  }
  if (types.includes('integer') && typeof value === 'number' && !Number.isInteger(value)) return `${path} must be a whole number.`;
  if (schema.enum && value !== null && !schema.enum.includes(value as string | number)) return `${path} must be one of: ${schema.enum.join(', ')}.`;
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) return `${path} must be at least ${schema.minimum}.`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${path} must be at most ${schema.maximum}.`;
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return `${path} must have at least ${schema.minItems} items.`;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${path} must have at most ${schema.maxItems} items.`;
    if (schema.items) {
      for (const [i, item] of value.entries()) {
        const error = checkInput(schema.items, item, `${path}[${i}]`);
        if (error) return error;
      }
    }
  }
  if (typeOf(value) === 'object' && schema.properties) {
    const fields = value as Record<string, unknown>;
    for (const name of schema.required ?? []) if (fields[name] === undefined) return `${path}.${name} is required.`;
    const known = Object.keys(schema.properties);
    for (const [name, field] of Object.entries(fields)) {
      const fieldSchema = schema.properties[name];
      if (!fieldSchema) return `${path}.${name} is not a known field. Known fields: ${known.join(', ')}.`;
      if (field === undefined) continue;
      const error = checkInput(fieldSchema, field, `${path}.${name}`);
      if (error) return error;
    }
  }
  return null;
}
