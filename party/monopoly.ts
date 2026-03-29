import type * as Party from "partykit/server";

interface PlayerData {
  id: string;
  originalId: string;
  name: string;
  avatar: number;
  isHost: boolean;
  disconnected?: boolean;
  disconnectedAt?: number;
}

interface RoomState {
  host: string;
  hostName: string;
  players: PlayerData[];
  gameState: any;
  isPrivate: boolean;
  maxPlayers: number;
  createdAt: number;
}

const RECONNECT_WINDOW_MS = 30 * 60 * 1000;
const MAX_STATE_BYTES = 512 * 1024;

function sanitizeName(name: string): string {
  return (name || "").toString().trim().replace(/[<>"'`]/g, "").slice(0, 30);
}

function getUniqueName(name: string, others: PlayerData[]): string {
  const base = sanitizeName(name) || "Player";
  const taken = new Set(others.map((p) => p.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

function genId(len: number): string {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  let r = "";
  for (let i = 0; i < len; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default class MonopolyRoom implements Party.Server {
  private state: RoomState | null = null;
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(readonly room: Party.Room) {}

  private async getState(): Promise<RoomState> {
    if (this.state) return this.state;
    const stored = await this.room.storage.get<RoomState>("room");
    this.state = stored ?? {
      host: "",
      hostName: "Player",
      players: [],
      gameState: null,
      isPrivate: false,
      maxPlayers: 5,
      createdAt: Date.now(),
    };
    return this.state!;
  }

  private async saveState() {
    if (this.state) await this.room.storage.put("room", this.state);
  }

  private async notifyLobby(state: RoomState) {
    try {
      const lobby = (this.room.context as any).parties?.lobby?.get("main");
      if (!lobby) return;
      const shouldRemove =
        state.players.length === 0 || !!state.gameState || state.isPrivate;
      await lobby.fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          shouldRemove
            ? { action: "remove", roomId: this.room.id }
            : {
                action: "update",
                roomId: this.room.id,
                room: {
                  roomId: this.room.id,
                  hostName: state.hostName,
                  playerCount: state.players.length,
                  maxPlayers: state.maxPlayers,
                  isPrivate: state.isPrivate,
                },
              }
        ),
      });
    } catch {
      // Lobby unavailable — non-fatal
    }
  }

  private bcast(msg: object, except?: string[]) {
    const str = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      if (!except?.includes(conn.id)) conn.send(str);
    }
  }

  private send(connId: string, msg: object) {
    this.room.getConnection(connId)?.send(JSON.stringify(msg));
  }

  async onConnect(_conn: Party.Connection) {
    // Wait for join_session message to link session
  }

  async onMessage(message: string, sender: Party.Connection) {
    let data: any;
    try { data = JSON.parse(message); } catch { return; }

    const state = await this.getState();

    switch (data.type) {
      case "join_session": {
        const { playerId } = data;
        const idx = state.players.findIndex(
          (p) => p.originalId === playerId || p.id === playerId
        );
        if (idx === -1) {
          sender.send(JSON.stringify({ type: "join_error", error: "Session not found" }));
          return;
        }
        const player = state.players[idx];
        const oldId = player.id;
        const timerKey = player.originalId || playerId;

        if (this.disconnectTimers.has(timerKey)) {
          clearTimeout(this.disconnectTimers.get(timerKey)!);
          this.disconnectTimers.delete(timerKey);
        }

        player.id = sender.id;
        player.disconnected = false;
        if (!player.originalId) player.originalId = playerId;
        if (state.host === oldId) state.host = sender.id;

        this.bcast({ type: "room_updated", players: state.players });

        if (state.gameState) {
          sender.send(JSON.stringify({ type: "sync_state", state: state.gameState }));
        }

        sender.send(
          JSON.stringify({ type: "join_session_ack", success: true, players: state.players, gameInProgress: !!state.gameState })
        );
        await this.saveState();
        break;
      }

      case "update_player": {
        const player = state.players.find((p) => p.id === sender.id);
        if (!player) return;
        if (data.name !== undefined) {
          player.name = getUniqueName(
            sanitizeName(data.name),
            state.players.filter((p) => p.id !== sender.id)
          );
        }
        if (data.avatar !== undefined) {
          if (state.players.some((p) => p.id !== sender.id && p.avatar === data.avatar)) {
            sender.send(JSON.stringify({ type: "update_error", error: "Color taken" }));
            return;
          }
          player.avatar = data.avatar;
        }
        this.bcast({ type: "room_updated", players: state.players });
        await this.saveState();
        break;
      }

      case "start_game": {
        if (state.host !== sender.id) return;
        state.gameState = data.initialState;
        this.bcast({ type: "game_started", state: data.initialState });
        await this.saveState();
        await this.notifyLobby(state);
        break;
      }

      case "kick_player": {
        if (state.host !== sender.id || state.gameState) return;
        const kickIdx = state.players.findIndex((p) => p.id === data.playerId);
        if (kickIdx === -1) return;
        const [kicked] = state.players.splice(kickIdx, 1);
        this.send(kicked.id, { type: "kicked" });
        this.bcast({ type: "room_updated", players: state.players });
        await this.saveState();
        await this.notifyLobby(state);
        break;
      }

      case "update_settings": {
        if (state.host !== sender.id || state.gameState) return;
        if (data.settings?.isPrivate !== undefined) state.isPrivate = data.settings.isPrivate;
        if (data.settings?.maxPlayers !== undefined) state.maxPlayers = data.settings.maxPlayers;
        this.bcast({ type: "settings_updated", settings: data.settings }, [sender.id]);
        await this.saveState();
        await this.notifyLobby(state);
        break;
      }

      case "send_chat": {
        this.bcast({ type: "chat_message", sender: data.sender, text: data.text, time: data.time });
        break;
      }

      case "game_action": {
        if (!state.players.some((p) => p.id === sender.id)) return;
        this.send(state.host, {
          type: "host_process_action",
          action: { ...data.action, _senderId: sender.id },
        });
        break;
      }

      case "sync_state": {
        if (state.host !== sender.id) return;
        if (!data.state) return;
        const size = JSON.stringify(data.state).length;
        if (size > MAX_STATE_BYTES) return;
        state.gameState = data.state;
        this.bcast({ type: "sync_state", state: data.state }, [sender.id]);
        await this.saveState();
        break;
      }

      case "reset_game": {
        if (state.host !== sender.id) return;
        state.gameState = null;
        this.bcast({ type: "game_reset" });
        await this.saveState();
        await this.notifyLobby(state);
        break;
      }
    }
  }

  async onClose(conn: Party.Connection) {
    const state = await this.getState();
    const idx = state.players.findIndex((p) => p.id === conn.id);
    if (idx === -1) return;

    const player = state.players[idx];
    const timerKey = player.originalId || player.id;

    if (!state.gameState) {
      // Lobby: remove immediately
      state.players.splice(idx, 1);
      if (state.players.length === 0) {
        await this.room.storage.delete("room");
        this.state = null;
        await this.notifyLobby({ ...state, players: [] });
        return;
      }
      if (state.host === player.id) {
        const next = state.players[0];
        state.host = next.id;
        next.isHost = true;
        state.hostName = next.name;
      }
      this.bcast({ type: "room_updated", players: state.players });
      await this.saveState();
    } else {
      // Game in progress: soft disconnect with reconnect window
      player.disconnected = true;
      player.disconnectedAt = Date.now();
      this.bcast({ type: "room_updated", players: state.players });
      await this.saveState();

      const timer = setTimeout(async () => {
        const s = await this.getState();
        const pidx = s.players.findIndex((p) => (p.originalId || p.id) === timerKey);
        if (pidx === -1 || !s.players[pidx].disconnected) return;

        const [removed] = s.players.splice(pidx, 1);
        this.disconnectTimers.delete(timerKey);

        if (s.players.length === 0) {
          await this.room.storage.delete("room");
          this.state = null;
          await this.notifyLobby({ ...s, players: [] });
          return;
        }

        if (s.host === removed.id) {
          const next = s.players.find((p) => !p.disconnected) || s.players[0];
          s.host = next.id;
          next.isHost = true;
          s.hostName = next.name;
          this.send(next.id, { type: "you_are_host" });
          if (s.gameState) this.send(next.id, { type: "sync_state", state: s.gameState });
        }

        this.bcast({ type: "room_updated", players: s.players });

        if (s.gameState?.players) {
          const cp = s.gameState.players[s.gameState.currentPlayerIndex];
          if (cp && (cp.id === timerKey || cp.originalId === timerKey)) {
            this.send(s.host, {
              type: "host_process_action",
              action: { type: "FORCE_END_TURN", payload: { removedPlayerId: timerKey } },
            });
          }
        }

        await this.saveState();
        await this.notifyLobby(s);
      }, RECONNECT_WINDOW_MS);

      this.disconnectTimers.set(timerKey, timer);
    }
    await this.notifyLobby(state);
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const state = await this.getState();

    if (req.method === "GET") {
      return Response.json(
        {
          roomId: this.room.id,
          playerCount: state.players.length,
          maxPlayers: state.maxPlayers,
          isPrivate: state.isPrivate,
          hostName: state.hostName,
          gameInProgress: !!state.gameState,
        },
        { headers: CORS }
      );
    }

    if (req.method === "POST") {
      let body: any;
      try { body = await req.json(); } catch { return new Response("Bad Request", { status: 400, headers: CORS }); }

      if (body.action === "create") {
        const playerId = "p_" + genId(8);
        const player: PlayerData = {
          id: playerId,
          originalId: playerId,
          name: sanitizeName(body.name) || "Player",
          avatar: body.avatar ?? 0,
          isHost: true,
        };
        state.host = playerId;
        state.hostName = player.name;
        state.players = [player];
        state.isPrivate = body.isPrivate ?? false;
        state.maxPlayers = body.maxPlayers ?? 5;
        state.createdAt = Date.now();
        state.gameState = null;
        await this.saveState();
        await this.notifyLobby(state);
        return Response.json(
          { success: true, roomId: this.room.id, playerId, players: state.players },
          { headers: CORS }
        );
      }

      if (body.action === "join") {
        if (state.gameState) {
          const spectatorId = "spectator_" + genId(8);
          return Response.json(
            { success: true, roomId: this.room.id, playerId: spectatorId, players: state.players, isSpectator: true },
            { headers: CORS }
          );
        }
        if (state.players.length >= state.maxPlayers) {
          return Response.json({ success: false, error: "Room is full" }, { status: 400, headers: CORS });
        }
        const playerId = "p_" + genId(8);
        const isFirstPlayer = state.players.length === 0;
        const player: PlayerData = {
          id: playerId,
          originalId: playerId,
          name: getUniqueName(sanitizeName(body.name) || "Player", state.players),
          avatar: body.avatar ?? 0,
          isHost: isFirstPlayer,
        };
        if (isFirstPlayer) {
          state.host = playerId;
          state.hostName = player.name;
        }
        state.players.push(player);
        await this.saveState();
        await this.notifyLobby(state);
        return Response.json(
          { success: true, roomId: this.room.id, playerId, players: state.players },
          { headers: CORS }
        );
      }
    }

    return new Response("Not Found", { status: 404, headers: CORS });
  }
}

MonopolyRoom satisfies Party.Worker;
