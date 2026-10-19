import { describe, expect, it, vi } from 'vitest';
import { ApiError, createTransport, type TokenSource } from './transport';
import { createProfileService } from './profile';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tokens(...values: (string | null)[]): TokenSource & { calls: (string | undefined)[] } {
  const calls: (string | undefined)[] = [];
  return {
    calls,
    getToken: async (reason) => {
      calls.push(reason);
      return values.shift() ?? null;
    },
  };
}

describe('createTransport', () => {
  it('sends the bearer token to the API base URL', async () => {
    const fetch = vi.fn(async () => json(200, { ok: true }));
    const transport = createTransport({ baseUrl: 'https://api.test/api/', tokens: tokens('t1'), fetch });
    await expect(transport.request('/profiles/me/')).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/profiles/me/');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer t1');
  });

  it('asks for a fresh token once after a 401 and retries', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(401, { detail: 'expired' }))
      .mockResolvedValueOnce(json(200, { username: 'kacper' }));
    const source = tokens('old', 'new');
    const transport = createTransport({ baseUrl: '/api', tokens: source, fetch });
    await expect(transport.request('/profiles/me/')).resolves.toEqual({ username: 'kacper' });
    expect(source.calls).toEqual([undefined, 'expired']);
    const retry = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(new Headers(retry[1].headers).get('Authorization')).toBe('Bearer new');
  });

  it('gives up as unauthorized when there is no token', async () => {
    const fetch = vi.fn();
    const transport = createTransport({ baseUrl: '/api', tokens: tokens(null), fetch });
    await expect(transport.request('/profiles/me/')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps the platform error shapes to typed errors', async () => {
    const cases: [number, unknown, string][] = [
      [403, { detail: 'Verify your email before doing that.' }, 'email-not-verified'],
      [403, { detail: 'Accept the seller terms first.' }, 'forbidden'],
      [404, { detail: 'Not found.' }, 'not-found'],
      [409, { detail: 'This game has been bought.' }, 'conflict'],
      [400, { title: ['This field may not be blank.'] }, 'validation'],
      [500, {}, 'server'],
    ];
    for (const [status, body, kind] of cases) {
      const transport = createTransport({
        baseUrl: '/api',
        tokens: tokens('t'),
        fetch: async () => json(status, body),
      });
      const error = await transport.request('/games/').catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).kind).toBe(kind);
    }
  });

  it('keeps field messages from a validation error', async () => {
    const transport = createTransport({
      baseUrl: '/api',
      tokens: tokens('t'),
      fetch: async () => json(400, { title: ['This field may not be blank.'] }),
    });
    const error = (await transport.request('/games/').catch((err: unknown) => err)) as ApiError;
    expect(error.fields).toEqual({ title: ['This field may not be blank.'] });
    expect(error.message).toBe('This field may not be blank.');
  });

  it('reports a network failure', async () => {
    const transport = createTransport({
      baseUrl: '/api',
      tokens: tokens('t'),
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(transport.request('/games/')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('createProfileService', () => {
  it('reads the signed-in profile', async () => {
    const transport = createTransport({
      baseUrl: '/api',
      tokens: tokens('t'),
      fetch: async () => json(200, { username: 'kacper', display_name: 'Kacper', extra: 1 }),
    });
    await expect(createProfileService(transport).me()).resolves.toEqual({
      username: 'kacper',
      displayName: 'Kacper',
    });
  });
});
