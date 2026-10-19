// Talks to the Chili platform page around the creator's iframe.
// Version 2 keeps every version 1 message (the platform ignores the extra
// `v` field) and adds the token handoff: the platform owns sign-in and its
// refresh tokens rotate, so the creator asks for an access token instead of
// refreshing one itself.

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export type EmbedMessage =
  | { type: 'chili-toast'; kind: 'success' | 'error' | 'info'; message: string }
  | { type: 'chili-save-state'; state: SaveState; unsaved: boolean }
  | { type: 'chili-project'; id: number | string }
  | { type: 'chili-project-new' }
  | { type: 'chili-project-removed' }
  | { type: 'chili-released'; id: number | string; slug: string }
  | { type: 'chili-navigate'; to: string }
  | { type: 'chili-auth-request'; id: string; reason?: TokenReason };

/** The platform's answer to `chili-auth-request`. */
export interface AuthAnswer {
  type: 'chili-auth';
  v: 2;
  id: string;
  access?: string;
  signedOut?: boolean;
}

/** `expired`: the API turned the last token down, so the platform should refresh. */
export type TokenReason = 'expired';

interface MessageTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface EmbedBridgeOptions {
  win: Window;
  /** The platform page, or null when the creator runs on its own. */
  parent: MessageTarget | null;
  /** Origin of the platform page; messages from anywhere else are ignored. */
  origin: string;
  /** How long to wait for an answer before using the stored token. */
  timeoutMs?: number;
}

export interface EmbedBridge {
  embedded: boolean;
  post(message: Exclude<EmbedMessage, { type: 'chili-auth-request' }>): void;
  /** An access token, or null when nobody is signed in. Never throws. */
  requestToken(reason?: TokenReason): Promise<string | null>;
  dispose(): void;
}

const ACCESS_KEY = 'chili.accessToken';

// Platform pages from before the handoff never answer; until they are
// replaced the creator reads (never refreshes) the token they store.
function storedToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function createEmbedBridge({
  win,
  parent,
  origin,
  timeoutMs = 1500,
}: EmbedBridgeOptions): EmbedBridge {
  const pending = new Map<string, (token: string | null) => void>();
  let inFlight: Promise<string | null> | null = null;
  let counter = 0;

  function onMessage(event: MessageEvent) {
    if (event.origin !== origin) {
      return;
    }
    const data = event.data as Partial<AuthAnswer> | null;
    if (data?.type !== 'chili-auth' || typeof data.id !== 'string') {
      return;
    }
    const resolve = pending.get(data.id);
    if (resolve) {
      resolve(data.signedOut ? null : (data.access ?? null));
    }
  }
  win.addEventListener('message', onMessage);

  function send(message: EmbedMessage) {
    parent?.postMessage({ ...message, v: 2 }, origin);
  }

  return {
    embedded: parent !== null,
    post: send,
    requestToken(reason) {
      if (!parent) {
        return Promise.resolve(storedToken());
      }
      if (inFlight) {
        return inFlight;
      }
      const id = `auth-${++counter}`;
      inFlight = new Promise<string | null>((resolve) => {
        const timer = win.setTimeout(() => finish(storedToken()), timeoutMs);
        function finish(token: string | null) {
          win.clearTimeout(timer);
          pending.delete(id);
          inFlight = null;
          resolve(token);
        }
        pending.set(id, finish);
        send({ type: 'chili-auth-request', id, ...(reason ? { reason } : {}) });
      });
      return inFlight;
    },
    dispose() {
      win.removeEventListener('message', onMessage);
      pending.forEach((finish) => finish(null));
    },
  };
}
