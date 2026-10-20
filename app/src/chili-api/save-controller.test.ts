import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './transport';
import { createSaveController, type SaveStatus } from './save-controller';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const sent: string[] = [];
  const pending: ReturnType<typeof deferred>[] = [];
  const statuses: SaveStatus[] = [];
  const controller = createSaveController({
    save: (data) => {
      sent.push(data);
      const d = deferred();
      pending.push(d);
      return d.promise;
    },
    delayMs: 700,
    onChange: (status) => statuses.push(status),
  });
  return { controller, sent, pending, statuses };
}

describe('createSaveController', () => {
  it('saves once typing pauses', async () => {
    const t = setup();
    t.controller.edit('a');
    t.controller.edit('ab');
    expect(t.controller.status()).toEqual({ state: 'saving', unsaved: true });
    await vi.advanceTimersByTimeAsync(699);
    expect(t.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.sent).toEqual(['ab']);
    t.pending[0]!.resolve();
    await vi.runAllTimersAsync();
    expect(t.controller.status()).toEqual({ state: 'saved', unsaved: false });
  });

  it('keeps one request in flight and sends what came in meanwhile', async () => {
    const t = setup();
    t.controller.edit('1');
    await vi.advanceTimersByTimeAsync(700);
    t.controller.edit('2');
    t.controller.edit('3');
    await vi.advanceTimersByTimeAsync(700);
    expect(t.sent).toEqual(['1']);
    t.pending[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.controller.status().unsaved).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(t.sent).toEqual(['1', '3']);
    t.pending[1]!.resolve();
    await vi.runAllTimersAsync();
    expect(t.controller.status()).toEqual({ state: 'saved', unsaved: false });
  });

  it('flushes right away when asked', async () => {
    const t = setup();
    t.controller.edit('now');
    const flushed = t.controller.flush();
    expect(t.sent).toEqual(['now']);
    t.pending[0]!.resolve();
    await flushed;
    expect(t.controller.status().state).toBe('saved');
  });

  it('does nothing when there is nothing new', async () => {
    const t = setup();
    await t.controller.flush();
    expect(t.sent).toEqual([]);
  });

  it('shows an error and retries on the next edit or when asked', async () => {
    const t = setup();
    t.controller.edit('x');
    const first = t.controller.flush();
    t.pending[0]!.reject(new ApiError('network', 'Failed to fetch'));
    await expect(first).rejects.toBeInstanceOf(ApiError);
    expect(t.controller.status()).toEqual({ state: 'error', unsaved: true, error: expect.any(ApiError) });
    // Still an error while the next save waits.
    t.controller.edit('xy');
    expect(t.controller.status().state).toBe('error');
    const retry = t.controller.retry();
    expect(t.sent).toEqual(['x', 'xy']);
    t.pending[1]!.resolve();
    await retry;
    expect(t.controller.status()).toEqual({ state: 'saved', unsaved: false });
  });

  it('starts clean from a loaded project', () => {
    const t = setup();
    t.controller.reset();
    expect(t.controller.status()).toEqual({ state: 'saved', unsaved: false });
    expect(t.statuses.at(-1)).toEqual({ state: 'saved', unsaved: false });
  });

  it('stops saving after dispose', async () => {
    const t = setup();
    t.controller.edit('late');
    t.controller.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.sent).toEqual([]);
  });
});
