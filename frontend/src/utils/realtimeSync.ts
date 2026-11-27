import type {
  JerseyKitId,
  RoomAuctionSnapshot,
  RoomChatMessage,
  TeamVoteChoice,
} from "../types/auction";

export type RoomWireMessage =
  | { type: "STATE_SYNC"; snapshot: RoomAuctionSnapshot; senderId: string }
  | {
      type: "JOIN_REQUEST";
      clientId: string;
      userId?: string;
      friendName: string;
      emailMasked?: string;
      kitId: JerseyKitId | null;
    }
  | { type: "SWITCH_TEAM"; clientId: string; kitId: JerseyKitId | null }
  | {
      type: "PROMOTE_CAPTAIN";
      requesterClientId: string;
      kitId: JerseyKitId;
      targetClientId: string;
    }
  | { type: "ROOM_CHAT"; message: RoomChatMessage }
  | {
      type: "TEAM_VOTE";
      clientId: string;
      username: string;
      teamId: string;
      choice: TeamVoteChoice;
      lotIdx: number;
      bidStepCount: number;
    }
  | { type: "REQUEST_SYNC"; clientId: string }
  | { type: "REMOTE_BID"; clientId: string; teamId: string }
  | { type: "REMOTE_PASS"; clientId: string; teamId: string }
  | { type: "PING"; clientId: string; kitId?: JerseyKitId | null; ts: number };

export interface RealtimeRoomTransport {
  readonly mode: "supabase" | "local";
  readonly roomCode: string;
  send(msg: RoomWireMessage): void;
  readCachedSnapshot(): RoomAuctionSnapshot | null;
  writeCachedSnapshot(snapshot: RoomAuctionSnapshot): void;
  subscribe(handler: (msg: RoomWireMessage) => void): () => void;
  destroy(): void;
}

const STORAGE_PREFIX = "ht_fc_room_";
const EVENT_PREFIX = "ht_fc_evt_";

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "server-client";
  const key = "ht_fc_client_id";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `c_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `c_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const url = meta?.VITE_SUPABASE_URL?.trim();
  const anonKey = meta?.VITE_SUPABASE_ANON_KEY?.trim();
  if (url && anonKey) return { url, anonKey };
  return null;
}

/**
 * Local BroadcastChannel + localStorage adapter for multi-tab testing & offline play.
 */
class LocalStorageRealtimeTransport implements RealtimeRoomTransport {
  readonly mode: "local" | "supabase" = "local";
  readonly roomCode: string;
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(msg: RoomWireMessage) => void>();
  private storageHandler: ((e: StorageEvent) => void) | null = null;

  constructor(roomCode: string) {
    this.roomCode = normalizeRoomCode(roomCode);
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(`${STORAGE_PREFIX}${this.roomCode}`);
      this.channel.onmessage = (ev) => {
        if (ev?.data) this.emit(ev.data as RoomWireMessage);
      };
    }
    if (typeof window !== "undefined") {
      this.storageHandler = (e: StorageEvent) => {
        if (e.key === `${EVENT_PREFIX}${this.roomCode}` && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue) as { msg: RoomWireMessage };
            if (parsed?.msg) this.emit(parsed.msg);
          } catch {}
        }
      };
      window.addEventListener("storage", this.storageHandler);
    }
  }

  protected emit(msg: RoomWireMessage) {
    if (msg.type === "STATE_SYNC") {
      this.writeCachedSnapshot(msg.snapshot);
    }
    for (const cb of this.listeners) cb(msg);
  }

  readCachedSnapshot(): RoomAuctionSnapshot | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${this.roomCode}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RoomAuctionSnapshot;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.config ||
        !Array.isArray(parsed.config.teamNames) ||
        !Array.isArray(parsed.teams) ||
        !Array.isArray(parsed.members)
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  writeCachedSnapshot(snapshot: RoomAuctionSnapshot): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${this.roomCode}`, JSON.stringify(snapshot));
    } catch {}
  }

  send(msg: RoomWireMessage): void {
    if (msg.type === "STATE_SYNC") {
      this.writeCachedSnapshot(msg.snapshot);
    }
    try {
      this.channel?.postMessage(msg);
    } catch {}
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(
          `${EVENT_PREFIX}${this.roomCode}`,
          JSON.stringify({ nonce: `${Date.now()}_${Math.random()}`, msg }),
        );
      } catch {}
    }
  }

  subscribe(handler: (msg: RoomWireMessage) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  destroy(): void {
    this.listeners.clear();
    try {
      this.channel?.close();
    } catch {}
    if (this.storageHandler && typeof window !== "undefined") {
      window.removeEventListener("storage", this.storageHandler);
    }
  }
}

/**
 * Lightweight Supabase Realtime Phoenix WebSocket Broadcast adapter + localStorage fallback.
 * Activates automatically when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are configured.
 */
class SupabaseRealtimeTransport extends LocalStorageRealtimeTransport {
  override readonly mode: "local" | "supabase" = "supabase";
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private refCounter = 1;
  private topic: string;
  private joined = false;
  private outbox: RoomWireMessage[] = [];

  constructor(roomCode: string, supaUrl: string, anonKey: string) {
    super(roomCode);
    this.topic = `realtime:${STORAGE_PREFIX}${this.roomCode}`;
    const wsBase = supaUrl.replace(/^http/i, "ws").replace(/\/+$/, "");
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.ws?.send(
          JSON.stringify({
            topic: this.topic,
            event: "phx_join",
            payload: { config: { broadcast: { self: false, ack: false } } },
            ref: String(this.refCounter++),
          }),
        );
        this.heartbeatTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                topic: "phoenix",
                event: "heartbeat",
                payload: {},
                ref: String(this.refCounter++),
              }),
            );
          }
        }, 25000);
      };

      this.ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(String(ev.data));
          if (frame?.event === "phx_reply" && frame?.payload?.status === "ok" && frame?.topic === this.topic) {
            this.joined = true;
            while (this.outbox.length > 0) {
              const queued = this.outbox.shift();
              if (queued) this.sendOverSocket(queued);
            }
          } else if (frame?.event === "broadcast" && frame?.payload?.payload) {
            const wire = frame.payload.payload as RoomWireMessage;
            this.emit(wire);
          }
        } catch {}
      };
    } catch {}
  }

  private sendOverSocket(msg: RoomWireMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.joined) {
      this.outbox.push(msg);
      return;
    }
    this.ws.send(
      JSON.stringify({
        topic: this.topic,
        event: "broadcast",
        payload: { type: "broadcast", event: "room_msg", payload: msg },
        ref: String(this.refCounter++),
      }),
    );
  }

  override send(msg: RoomWireMessage): void {
    super.send(msg);
    this.sendOverSocket(msg);
  }

  override destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    try {
      this.ws?.close();
    } catch {}
    super.destroy();
  }
}

export function createRealtimeTransport(roomCode: string): RealtimeRoomTransport {
  const supa = getSupabaseEnv();
  if (supa && typeof WebSocket !== "undefined") {
    return new SupabaseRealtimeTransport(roomCode, supa.url, supa.anonKey);
  }
  return new LocalStorageRealtimeTransport(roomCode);
}
