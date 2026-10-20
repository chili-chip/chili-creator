// HTTP to the Chili platform API (Django REST Framework).

export type ApiErrorKind =
  | 'unauthorized'
  | 'email-not-verified'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  /** The account already has the most games the platform keeps (30). */
  | 'project-limit'
  /** Game data over the platform's 1.5 MB. */
  | 'too-large'
  | 'rate-limited'
  | 'server'
  | 'network';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status = 0,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Where access tokens come from (the embed bridge in the app). */
export interface TokenSource {
  getToken(reason?: 'expired'): Promise<string | null>;
}

export interface TransportOptions {
  /** Like "https://api.chilichip.eu/api"; a trailing slash is fine. */
  baseUrl: string;
  tokens: TokenSource;
  fetch?: typeof fetch;
}

export interface Transport {
  request<T = unknown>(path: string, init?: RequestInit): Promise<T>;
}

// DRF answers `{detail: "..."}` or `{field: ["...", ...]}`.
function toError(status: number, body: unknown): ApiError {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const detail = typeof record.detail === 'string' ? record.detail : '';
  const fields: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      fields[key] = value.map(String);
    }
  }
  const message = detail || Object.values(fields).flat()[0] || `Request failed (${status})`;
  if (status === 401) return new ApiError('unauthorized', message, status);
  if (status === 403) {
    const kind = /verify your email/i.test(detail) ? 'email-not-verified' : 'forbidden';
    return new ApiError(kind, message, status);
  }
  if (status === 404) return new ApiError('not-found', message, status);
  if (status === 409) return new ApiError('conflict', message, status);
  if (status === 429) return new ApiError('rate-limited', message, status);
  if (status === 400) {
    if (/you can keep \d+ projects/i.test(detail)) return new ApiError('project-limit', message, status);
    if (fields.data?.some((text) => /MB or smaller/i.test(text))) {
      return new ApiError('too-large', message, status, fields);
    }
    return new ApiError('validation', message, status, fields);
  }
  return new ApiError('server', message, status);
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createTransport({ baseUrl, tokens, fetch: fetchImpl = fetch }: TransportOptions): Transport {
  const base = baseUrl.replace(/\/+$/, '');
  const absoluteBase = new URL(base, globalThis.location?.href ?? 'http://localhost/').href;

  // Paths are relative to the base; DRF's pagination links are absolute.
  function urlFor(path: string): string {
    if (!/^https?:/i.test(path)) return `${base}${path}`;
    if (!path.startsWith(`${absoluteBase}/`)) {
      throw new ApiError('network', `Refusing to call outside the API: ${path}`);
    }
    return path;
  }

  async function send(path: string, init: RequestInit, token: string) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    try {
      return await fetchImpl(urlFor(path), { ...init, headers });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('network', err instanceof Error ? err.message : 'Network error');
    }
  }

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      urlFor(path);
      let token = await tokens.getToken();
      if (!token) {
        throw new ApiError('unauthorized', 'Sign in to continue.', 401);
      }
      let response = await send(path, init, token);
      if (response.status === 401) {
        token = await tokens.getToken('expired');
        if (!token) {
          throw new ApiError('unauthorized', 'Sign in to continue.', 401);
        }
        response = await send(path, init, token);
      }
      const body = await readBody(response);
      if (!response.ok) {
        throw toError(response.status, body);
      }
      return body as T;
    },
  };
}
