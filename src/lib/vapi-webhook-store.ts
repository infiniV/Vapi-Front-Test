type WebhookEvent = {
  id: string;
  receivedAt: string; // ISO
  // payload will contain either parsed JSON in `parsed` or raw text in `raw`.
  payload: any;
  contentType?: string;
  size?: number; // bytes/characters of the raw body
  verified?: boolean; // optional signature verification result
  eventType?: string; // optional convenience field extracted from payload
};

const MAX_EVENTS = 200;

const store: WebhookEvent[] = [];

/**
 * Push a webhook event into the in-memory store.
 * Accepts a richer payload object so callers can supply parsed/raw/contentType/verified
 */
export function pushWebhookEvent(stored: {
  payload: any;
  contentType?: string;
  size?: number;
  verified?: boolean;
}) {
  const { payload, contentType, size, verified } = stored;

  const evt: WebhookEvent = {
    id: Math.random().toString(36).substring(2, 9),
    receivedAt: new Date().toISOString(),
    payload,
    contentType,
    size,
    verified,
    eventType:
      (payload && (payload.type || payload.event || payload.eventType)) || undefined,
  };

  store.unshift(evt);
  if (store.length > MAX_EVENTS) store.pop();
  return evt;
}

export function listWebhookEvents(limit = 50, sinceIso?: string) {
  let results = store.slice(0, Math.min(limit, store.length));
  if (sinceIso) {
    const since = new Date(sinceIso).toISOString();
    results = results.filter((e) => e.receivedAt > since).slice(0, Math.min(limit, results.length));
  }
  return results;
}

export function clearWebhookEvents() {
  store.length = 0;
}

export type { WebhookEvent };
