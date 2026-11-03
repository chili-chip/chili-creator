import { describe, expect, it, vi } from 'vitest';
import { fakeModelContext } from '../test/agent';
import { picture, type AgentContext, type AgentTool } from './types';
import { connectAgentTools, findModelContext } from './webmcp';

const context = {} as AgentContext;

const echo: AgentTool<{ text: string }> = {
  name: 'echo',
  title: 'Echo',
  description: 'Says the text back.',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  readOnly: true,
  run: ({ text }) => ({ text }),
};

const broken: AgentTool = {
  name: 'broken',
  title: 'Broken',
  description: 'Always fails.',
  inputSchema: { type: 'object', properties: {} },
  asksFirst: true,
  run: () => {
    throw new Error('Open a game first.');
  },
};

describe('connectAgentTools', () => {
  it('registers each tool with its schema and hints', () => {
    const mc = fakeModelContext();
    connectAgentTools(mc, [echo, broken], context);
    expect([...mc.tools.keys()]).toEqual(['echo', 'broken']);
    const tool = mc.tools.get('echo')!;
    expect(tool).toMatchObject({ name: 'echo', title: 'Echo', description: 'Says the text back.', annotations: { readOnlyHint: true } });
    expect(tool.inputSchema).toEqual(echo.inputSchema);
    expect(mc.tools.get('broken')!.annotations).toEqual({ readOnlyHint: false, consequentialHint: true });
  });

  it('answers with JSON text, as an MCP tool result', async () => {
    const mc = fakeModelContext();
    connectAgentTools(mc, [echo], context);
    const result = await mc.tools.get('echo')!.execute({ text: 'hi' }, {});
    expect(result).toEqual({ content: [{ type: 'text', text: '{"text":"hi"}' }] });
  });

  it('turns bad input and thrown errors into error results the agent can read', async () => {
    const mc = fakeModelContext();
    connectAgentTools(mc, [echo, broken], context);
    expect(await mc.call('echo', {})).toEqual({ error: 'input.text is required.' });
    expect(await mc.call('broken', {})).toEqual({ error: 'Open a game first.' });
    const raw = await mc.tools.get('broken')!.execute({}, {});
    expect(raw).toMatchObject({ isError: true });
  });

  it('sends pictures as PNG images next to the text', async () => {
    const mc = fakeModelContext();
    const shot: AgentTool = { ...echo, name: 'shot', run: () => picture(new Uint8Array([1, 2, 3]), { room: '0' }) };
    connectAgentTools(mc, [shot], context);
    const result = await mc.tools.get('shot')!.execute({ text: '' }, {});
    expect(result).toEqual({
      content: [
        { type: 'text', text: '{"room":"0"}' },
        { type: 'image', data: 'AQID', mimeType: 'image/png' },
      ],
    });
  });

  it('takes the tools away again', () => {
    const mc = fakeModelContext();
    const unregisterTool = vi.fn();
    const disconnect = connectAgentTools({ ...mc, registerTool: mc.registerTool, unregisterTool }, [echo], context);
    disconnect();
    expect(mc.tools.size).toBe(0);
    expect(unregisterTool).toHaveBeenCalledWith('echo');
  });

  it('keeps going when the browser refuses a tool', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registerTool = vi.fn(async () => {
      throw new Error('taken');
    });
    expect(() => connectAgentTools({ registerTool }, [echo, broken], context)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('findModelContext', () => {
  it('uses document.modelContext, then navigator.modelContext, else none', () => {
    const mc = fakeModelContext();
    expect(findModelContext({ document: { modelContext: mc }, navigator: {} } as never)).toBe(mc);
    expect(findModelContext({ document: {}, navigator: { modelContext: mc } } as never)).toBe(mc);
    expect(findModelContext({ document: {}, navigator: {} } as never)).toBeNull();
  });
});
