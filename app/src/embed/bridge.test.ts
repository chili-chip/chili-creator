import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmbedBridge, type EmbedMessage } from './bridge';

const ORIGIN = 'https://platform.test';

// A fake parent page: records what the creator posts and can answer.
function fakeParent() {
  const posted: { message: EmbedMessage; origin: string }[] = [];
  return {
    posted,
    postMessage(message: EmbedMessage, origin: string) {
      posted.push({ message, origin });
    },
  };
}

function answer(data: unknown, origin = ORIGIN) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createEmbedBridge', () => {
  it('posts version 2 messages to the parent on its own origin', () => {
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN });
    bridge.post({ type: 'chili-save-state', state: 'saved', unsaved: false });
    expect(parent.posted).toEqual([
      { message: { type: 'chili-save-state', state: 'saved', unsaved: false, v: 2 }, origin: ORIGIN },
    ]);
    bridge.dispose();
  });

  it('is not embedded and posts nothing when there is no parent page', () => {
    const bridge = createEmbedBridge({ win: window, parent: null, origin: ORIGIN });
    expect(bridge.embedded).toBe(false);
    expect(() => bridge.post({ type: 'chili-project-new' })).not.toThrow();
    bridge.dispose();
  });

  it('asks the parent for a token and resolves with its answer', async () => {
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN });
    const token = bridge.requestToken();
    const request = parent.posted[0]!.message as { type: string; id: string };
    expect(request.type).toBe('chili-auth-request');
    answer({ type: 'chili-auth', v: 2, id: request.id, access: 'abc' });
    await expect(token).resolves.toBe('abc');
    bridge.dispose();
  });

  it('reuses the token it was given until the API turns it down', async () => {
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN });
    const first = bridge.requestToken();
    const request = parent.posted[0]!.message as { id: string };
    answer({ type: 'chili-auth', v: 2, id: request.id, access: 'abc' });
    await first;
    await expect(bridge.requestToken()).resolves.toBe('abc');
    expect(parent.posted).toHaveLength(1);
    void bridge.requestToken('expired');
    expect(parent.posted).toHaveLength(2);
    bridge.dispose();
  });

  it('asks again after a signed-out answer', async () => {
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN });
    const first = bridge.requestToken();
    answer({ type: 'chili-auth', v: 2, id: (parent.posted[0]!.message as { id: string }).id, signedOut: true });
    await expect(first).resolves.toBeNull();
    void bridge.requestToken();
    expect(parent.posted).toHaveLength(2);
    bridge.dispose();
  });

  it('passes the reason, so the parent refreshes an expired token', () => {
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN });
    void bridge.requestToken('expired');
    expect(parent.posted[0]!.message).toMatchObject({ type: 'chili-auth-request', reason: 'expired' });
    bridge.dispose();
  });

  it('resolves with null when the parent says the user is signed out', async () => {
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN });
    const token = bridge.requestToken();
    const { id } = parent.posted[0]!.message as { id: string };
    answer({ type: 'chili-auth', v: 2, id, signedOut: true });
    await expect(token).resolves.toBeNull();
    bridge.dispose();
  });

  it('ignores answers from another origin', async () => {
    vi.useFakeTimers();
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN, timeoutMs: 100 });
    const token = bridge.requestToken();
    const { id } = parent.posted[0]!.message as { id: string };
    answer({ type: 'chili-auth', v: 2, id, access: 'evil' }, 'https://evil.test');
    vi.advanceTimersByTime(100);
    await expect(token).resolves.toBeNull();
    bridge.dispose();
  });

  it('falls back to the stored access token when an older platform page does not answer', async () => {
    vi.useFakeTimers();
    localStorage.setItem('chili.accessToken', 'stored');
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN, timeoutMs: 100 });
    const token = bridge.requestToken();
    vi.advanceTimersByTime(100);
    await expect(token).resolves.toBe('stored');
    bridge.dispose();
  });

  it('shares one request while an answer is pending', () => {
    const parent = fakeParent();
    const bridge = createEmbedBridge({ win: window, parent, origin: ORIGIN });
    void bridge.requestToken();
    void bridge.requestToken();
    expect(parent.posted).toHaveLength(1);
    bridge.dispose();
  });

  it('reads the stored token straight away when not embedded', async () => {
    localStorage.setItem('chili.accessToken', 'stored');
    const bridge = createEmbedBridge({ win: window, parent: null, origin: ORIGIN });
    await expect(bridge.requestToken()).resolves.toBe('stored');
    bridge.dispose();
  });
});
