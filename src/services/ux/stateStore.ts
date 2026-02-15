import { randomUUID } from "crypto";

type Entry<T> = { value: T; expiresAt: number };

/**
 * In-memory state store with TTL.
 * - Stores short keys safe for Discord custom_id.
 * - State is lost on process restart (acceptable for UI sessions).
 */
export class StateStore<T> {
  private map = new Map<string, Entry<T>>();

  constructor(private ttlMs: number) {}

  put(value: T): string {
    const key = randomUUID().slice(0, 10); // short and safe for custom_id
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return key;
  }

  get(key: string): T | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return e.value;
  }

  update(key: string, updater: (prev: T) => T): T | null {
    const prev = this.get(key);
    if (!prev) return null;
    const next = updater(prev);
    this.map.set(key, { value: next, expiresAt: Date.now() + this.ttlMs });
    return next;
  }

  touch(key: string) {
    const e = this.map.get(key);
    if (e) e.expiresAt = Date.now() + this.ttlMs;
  }

  delete(key: string) {
    this.map.delete(key);
  }
}
