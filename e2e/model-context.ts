import type { Page } from '@playwright/test';

// WebMCP is not in most browsers yet, so each frame gets a stand-in
// `document.modelContext` that keeps the tools the creator offers.

type Result = { content: ({ type: 'text'; text: string } | { type: 'image'; data: string })[]; isError?: boolean };

export async function withModelContext(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute(input: object, options: object): Promise<unknown> }>();
    (document as unknown as { modelContext: unknown }).modelContext = {
      tools,
      registerTool(tool: { name: string; execute(input: object, options: object): Promise<unknown> }, options?: { signal?: AbortSignal }) {
        tools.set(tool.name, tool);
        options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
      },
    };
  });
}

/** Calls a tool in the creator's frame; gives back its JSON answer and how many pictures came with it. */
export async function call(page: Page, name: string, input: object = {}) {
  const frame = page.frames().find((f) => f.url().includes('/index.html'))!;
  const result = (await frame.evaluate(
    async ([tool, args]) => {
      const context = (document as unknown as { modelContext: { tools: Map<string, { execute(i: object, o: object): Promise<unknown> }> } }).modelContext;
      return context.tools.get(tool as string)!.execute(args as object, {});
    },
    [name, input] as const,
  )) as Result;
  const text = (result.content[0] as { text: string }).text;
  if (result.isError) throw new Error(`${name}: ${text}`);
  const images = result.content.flatMap((part) => (part.type === 'image' ? [part.data] : []));
  return { data: JSON.parse(text), pictures: images.length, images };
}
