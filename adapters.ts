// Persistence adapters. The app talks only to the DataAdapter interface, so switching from
// local demo mode to Supabase is a configuration change, not a rewrite.

import type { Database } from "./types";
import { buildSeed, DB_VERSION } from "@/data/seed";

export interface DataAdapter {
  mode: "local" | "supabase";
  load(): Promise<Database>;
  /** Persist the next state. `prev` lets remote adapters send only what changed. */
  save(next: Database, prev: Database): Promise<void>;
  reset(): Promise<Database>;
}

const STORAGE_KEY = "carebase:db";
let memoryFallback: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryFallback;
  }
}
function writeRaw(v: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v);
  } catch {
    memoryFallback = v;
  }
}

export const localAdapter: DataAdapter = {
  mode: "local",
  async load() {
    const raw = readRaw();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Database;
        if (parsed.version === DB_VERSION) return parsed;
      } catch {
        /* corrupted — fall through to reseed */
      }
    }
    const seed = buildSeed();
    writeRaw(JSON.stringify(seed));
    return seed;
  },
  async save(next) {
    writeRaw(JSON.stringify(next));
  },
  async reset() {
    const seed = buildSeed();
    writeRaw(JSON.stringify(seed));
    return seed;
  },
};

// ---------------- Supabase ----------------
// Maps each in-memory collection to its Postgres table (see supabase/migrations).
const TABLES: Record<string, string> = {
  staff: "staff",
  animals: "animals",
  cases: "cases",
  careUpdates: "care_updates",
  handovers: "handovers",
  tasks: "tasks",
  dutySchedules: "duty_schedules",
  activityLogs: "activity_logs",
  notifications: "notifications",
};

const toSnake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const mapKeys = (o: Record<string, unknown>, f: (k: string) => string) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v === undefined ? null : v]));

export async function createSupabaseAdapter(url: string, anonKey: string): Promise<DataAdapter> {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, anonKey);

  const adapter: DataAdapter = {
    mode: "supabase",
    async load() {
      const db = buildSeed();
      for (const [key, table] of Object.entries(TABLES)) {
        const { data, error } = await sb.from(table).select("*");
        if (error) throw error;
        (db as unknown as Record<string, unknown>)[key] = (data ?? []).map((r) =>
          Object.fromEntries(Object.entries(mapKeys(r, toCamel)).filter(([, v]) => v !== null)),
        );
      }
      const { data: settings } = await sb.from("shelter_settings").select("*").limit(1).maybeSingle();
      if (settings) db.settings = mapKeys(settings, toCamel) as unknown as Database["settings"];
      return db;
    },
    async save(next, prev) {
      // Immutable updates keep unchanged rows referentially equal, so a reference diff is enough.
      for (const [key, table] of Object.entries(TABLES)) {
        const a = (prev as unknown as Record<string, { id: string }[]>)[key];
        const b = (next as unknown as Record<string, { id: string }[]>)[key];
        if (a === b) continue;
        const prevById = new Map(a.map((r) => [r.id, r]));
        const changed = b.filter((r) => prevById.get(r.id) !== r);
        const nextIds = new Set(b.map((r) => r.id));
        const removed = a.filter((r) => !nextIds.has(r.id)).map((r) => r.id);
        if (changed.length) {
          const { error } = await sb.from(table).upsert(changed.map((r) => mapKeys(r as unknown as Record<string, unknown>, toSnake)));
          if (error) throw error;
        }
        if (removed.length) {
          const { error } = await sb.from(table).delete().in("id", removed);
          if (error) throw error;
        }
      }
      if (prev.settings !== next.settings) {
        await sb.from("shelter_settings").upsert({ id: 1, ...mapKeys(next.settings as unknown as Record<string, unknown>, toSnake) });
      }
    },
    async reset() {
      return adapter.load();
    },
  };
  return adapter;
}

export async function getAdapter(): Promise<DataAdapter> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) {
    try {
      return await createSupabaseAdapter(url, key);
    } catch (e) {
      console.warn("Supabase unavailable, falling back to local demo mode", e);
    }
  }
  return localAdapter;
}
