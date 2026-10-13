export type EventMap = Record<string, unknown>;
export type EventHandler<Payload> = (payload: Payload) => void;

interface Subscription {
  handler: EventHandler<never>;
  once: boolean;
}

/**
 * Typed publish/subscribe bus.
 *
 * `emit` iterates a snapshot so a handler may subscribe, unsubscribe or emit re-entrantly without
 * corrupting the iteration. Handler errors are reported rather than swallowed, but they do not
 * stop the remaining handlers.
 */
export class EventBus<Events extends EventMap = EventMap> {
  private readonly channels = new Map<keyof Events, Set<Subscription>>();
  private readonly onError: (error: unknown, type: keyof Events) => void;

  constructor(onError?: (error: unknown, type: keyof Events) => void) {
    this.onError = onError ?? ((error, type) => {
      // eslint-disable-next-line no-console
      console.error(`EventBus handler for "${String(type)}" threw`, error);
    });
  }

  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    return this.add(type, handler as EventHandler<never>, false);
  }

  once<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    return this.add(type, handler as EventHandler<never>, true);
  }

  private add(type: keyof Events, handler: EventHandler<never>, once: boolean): () => void {
    let set = this.channels.get(type);
    if (!set) {
      set = new Set();
      this.channels.set(type, set);
    }
    const subscription: Subscription = { handler, once };
    set.add(subscription);
    return () => set.delete(subscription);
  }

  off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void {
    const set = this.channels.get(type);
    if (!set) return;
    for (const subscription of set) {
      if (subscription.handler === (handler as unknown as EventHandler<never>)) set.delete(subscription);
    }
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.channels.get(type);
    if (!set || set.size === 0) return;

    // Snapshot: handlers commonly subscribe/unsubscribe from inside a handler.
    for (const subscription of Array.from(set)) {
      if (subscription.once) set.delete(subscription);
      try {
        (subscription.handler as EventHandler<Events[K]>)(payload);
      } catch (error) {
        this.onError(error, type);
      }
    }
  }

  listenerCount<K extends keyof Events>(type: K): number {
    return this.channels.get(type)?.size ?? 0;
  }

  /** Detach every handler; called when a world or engine is disposed. */
  clear(type?: keyof Events): void {
    if (type === undefined) this.channels.clear();
    else this.channels.delete(type);
  }
}
