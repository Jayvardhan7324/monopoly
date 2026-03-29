import express from "express";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";

interface RoomData {
  host: string;
  hostName: string;
  players: any[];
  state: any;
  isPrivate: boolean;
  maxPlayers: number;
  createdAt: number;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  // Serve audio assets from richup_assets/sounds at /sounds
  const pathModule = await import("path");
  app.use("/sounds", express.static(
    pathModule.default.resolve(process.cwd(), "richup_assets/sounds")
  ));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const rooms = new Map<string, RoomData>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>(); // keyed by originalPlayerId
  const roomIdleTimers = new Map<string, NodeJS.Timeout>(); // keyed by roomId — fires when all players disconnected

  // Debounced rooms_list broadcast — collapses bursts of calls into one emit per 50ms
  let roomsListFlushTimer: NodeJS.Timeout | null = null;
  function scheduleRoomsListBroadcast() {
    if (roomsListFlushTimer) return;
    roomsListFlushTimer = setTimeout(() => {
      roomsListFlushTimer = null;
      scheduleRoomsListBroadcast();
    }, 50);
  }
  const RECONNECT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes per-player reconnect window
  const ROOM_IDLE_TTL = 60 * 60 * 1000; // 1 hour — room survives fully disconnected before deletion

  // Background GC: delete zombie rooms every 15 min
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      const allDisconnected = room.players.length > 0 && room.players.every((p: any) => p.disconnected);
      if (allDisconnected && now - room.createdAt > ROOM_IDLE_TTL) {
        // B7: Clear all pending disconnect timers before deleting room
        for (const p of room.players) {
          const key = (p as any).originalId || (p as any).id;
          if (disconnectTimers.has(key)) {
            clearTimeout(disconnectTimers.get(key)!);
            disconnectTimers.delete(key);
          }
        }
        roomIdleTimers.delete(roomId);
        rooms.delete(roomId);
        console.log(`GC: deleted stale room ${roomId} (all disconnected > 1hr)`);
      }
    }
  }, 15 * 60 * 1000);

  // Permanently removes a player after the reconnect window expires
  function permanentlyRemovePlayer(roomId: string, originalPlayerId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    const idx = room.players.findIndex((p: any) => (p.originalId || p.id) === originalPlayerId);
    if (idx === -1) return;
    const player = room.players[idx];
    // If they reconnected before the timer fired, don't remove them
    if (!player.disconnected) return;
    room.players.splice(idx, 1);
    disconnectTimers.delete(originalPlayerId);
    if (room.players.length === 0) {
      rooms.delete(roomId);
    } else {
      // Transfer host if the removed player was host
      if (room.host === player.id) {
        const next = room.players.find((p: any) => !p.disconnected) || room.players[0];
        const heir = next;
        room.host = heir.id;
        heir.isHost = true;
        room.hostName = heir.name || 'Player';
        // B4: Sync full game state to new host and inform them of their new role
        if (room.state) {
          io.to(heir.id).emit("sync_state", { state: room.state });
        }
        io.to(heir.id).emit("you_are_host");
      }
      io.to(roomId).emit("room_updated", { players: room.players });
      // B3: If the removed player was the current turn player, force turn advancement
      if (room.state && room.state.players) {
        const currentPlayer = room.state.players[room.state.currentPlayerIndex];
        if (currentPlayer && (currentPlayer.id === originalPlayerId || currentPlayer.originalId === originalPlayerId)) {
          io.to(room.host).emit("host_process_action", {
            type: 'FORCE_END_TURN',
            payload: { removedPlayerId: originalPlayerId },
          });
        }
      }
    }
    scheduleRoomsListBroadcast();
    console.log(`Player ${originalPlayerId} permanently removed from room ${roomId} (reconnect window expired).`);
  }

  const GAMERTAG_ADJECTIVES = [
    'Swift', 'Brave', 'Fierce', 'Bold', 'Dark', 'Iron', 'Stone', 'Silent',
    'Shadow', 'Crimson', 'Silver', 'Golden', 'Arctic', 'Cosmic', 'Neon',
    'Phantom', 'Rogue', 'Thunder', 'Velvet', 'Blazing', 'Crystal', 'Electric',
    'Sacred', 'Frozen', 'Obsidian', 'Scarlet', 'Astral', 'Hollow', 'Ember', 'Void'
  ];
  const GAMERTAG_NOUNS = [
    'Falcon', 'Wolf', 'Panther', 'Dragon', 'Phoenix', 'Hawk', 'Blade', 'Shield',
    'Ghost', 'Viper', 'Tiger', 'Lion', 'Fox', 'Raven', 'Eagle', 'Cobra',
    'Titan', 'Ranger', 'Knight', 'Wizard', 'Ninja', 'Viking', 'Warrior',
    'Samurai', 'Mage', 'Archer', 'Scout', 'Cipher', 'Wraith', 'Oracle'
  ];

  function generateGamertag(): string {
    const adj = GAMERTAG_ADJECTIVES[Math.floor(Math.random() * GAMERTAG_ADJECTIVES.length)];
    const noun = GAMERTAG_NOUNS[Math.floor(Math.random() * GAMERTAG_NOUNS.length)];
    return `${adj}${noun}`;
  }

  function sanitizeName(name: any): string {
    return (String(name || '')).replace(/[^\x20-\x7E]/g, '').trim().slice(0, 20);
  }

  function getUniqueName(baseName: string, players: any[]) {
    const stripped = (baseName || '').trim();
    // Use a gamertag when the player hasn't set a real name (empty, or default "Player 1", "Player 2", etc.)
    let name = (!stripped || stripped.toLowerCase().startsWith('player')) ? generateGamertag() : stripped;
    let suffix = 1;
    let finalName = name;
    while (players.some(p => p.name === finalName)) {
      finalName = `${name}${suffix}`;   // e.g. SwiftFalcon2 (no brackets, stays clean)
      suffix++;
    }
    return finalName;
  }

  function getPublicRoomsList() {
    const publicRooms: any[] = [];
    for (const [id, room] of rooms.entries()) {
      // Only list rooms that are: public, not started, and not full
      if (!room.isPrivate && !room.state) {
        publicRooms.push({
          roomId: id,
          hostName: room.hostName,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          createdAt: room.createdAt,
        });
      }
    }
    // Sort by newest first
    publicRooms.sort((a, b) => b.createdAt - a.createdAt);
    return publicRooms;
  }

  // REST API: List active public rooms
  app.get("/api/rooms", (req, res) => {
    res.json(getPublicRoomsList());
  });

  // REST API: Create a room
  app.post("/api/rooms", (req, res) => {
    const data = req.body;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const playerId = "p_" + Math.random().toString(36).substring(2, 10);
    const player = { id: playerId, originalId: playerId, name: sanitizeName(data.name), avatar: data.avatar, isHost: true };
    rooms.set(roomId, {
      host: playerId, // Will be updated to socket.id when they connect
      hostName: sanitizeName(data.name) || 'Player',
      players: [player],
      state: null,
      isPrivate: data.isPrivate || false,
      maxPlayers: data.maxPlayers || 5,
      createdAt: Date.now(),
    });

    // Broadcast updated room list to everyone (via socket)
    scheduleRoomsListBroadcast();
    res.json({ success: true, roomId, playerId, players: [player] });
  });

  // REST API: Join a random room
  app.post("/api/rooms/random", (req, res) => {
    const data = req.body;
    // Find a room that is not full, not private, and hasn't started
    let targetRoomId = null;
    for (const [id, room] of rooms.entries()) {
      if (!room.state && !room.isPrivate && room.players.length < room.maxPlayers) {
        targetRoomId = id;
        break;
      }
    }

    if (targetRoomId) {
      const room = rooms.get(targetRoomId)!;
      const playerId = "p_" + Math.random().toString(36).substring(2, 10);
      const uniqueName = getUniqueName(sanitizeName(data.name), room.players);
      const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false };
      room.players.push(player);
      // We don't broadcast room_updated here because socket isn't connected yet.
      // We will broadcast when they actually connect their socket.
      res.json({ success: true, roomId: targetRoomId, playerId, players: room.players });
    } else {
      // Create a new room
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const playerId = "p_" + Math.random().toString(36).substring(2, 10);
      const player = { id: playerId, originalId: playerId, name: sanitizeName(data.name), avatar: data.avatar, isHost: true };
      rooms.set(roomId, {
        host: playerId,
        hostName: sanitizeName(data.name) || 'Player',
        players: [player],
        state: null,
        isPrivate: false,
        maxPlayers: 5,
        createdAt: Date.now(),
      });
      scheduleRoomsListBroadcast();
      res.json({ success: true, roomId, playerId, players: [player] });
    }
  });

  // REST API: Join a specific room
  app.post("/api/rooms/:id/join", (req, res) => {
    const roomId = req.params.id.trim().toUpperCase();
    const data = req.body;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    if (room.state) {
      // Game already started — allow joining as spectator
      const playerId = "p_" + Math.random().toString(36).substring(2, 10);
      const uniqueName = getUniqueName(sanitizeName(data.name), room.players);
      const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false, isSpectator: true };
      room.players.push(player);
      res.json({ success: true, roomId: roomId, playerId, players: room.players, isSpectator: true });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ success: false, error: "Room is full" });
    }

    const playerId = "p_" + Math.random().toString(36).substring(2, 10);
    const uniqueName = getUniqueName(sanitizeName(data.name), room.players);
    const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false };
    room.players.push(player);

    scheduleRoomsListBroadcast();
    res.json({ success: true, roomId: roomId, playerId, players: room.players });
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Initial connection linking REST session to Socket
    socket.on("join_session", (data, callback) => {
      const { playerId } = data;
      const roomId = data.roomId?.trim().toUpperCase();
      const room = rooms.get(roomId);

      if (!room) {
        if (callback) callback({ success: false, error: "Room not found" });
        return;
      }

      // Search by originalId first (handles reconnects after socket ID change)
      // then fall back to current id (first-time connection)
      const playerIndex = room.players.findIndex((p: any) =>
        p.originalId === playerId || p.id === playerId
      );

      if (playerIndex === -1) {
        if (callback) callback({ success: false, error: "Player session not found in room" });
        return;
      }

      const player = room.players[playerIndex];
      const oldId = player.id;

      // Clear any active disconnect timer for this player
      const timerKey = player.originalId || playerId;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey)!);
        disconnectTimers.delete(timerKey);
        console.log(`Player ${timerKey} reconnected to room ${roomId}. Disconnect timer cleared.`);
      }
      // Clear room-level idle timer if someone is reconnecting
      if (roomIdleTimers.has(roomId)) {
        clearTimeout(roomIdleTimers.get(roomId)!);
        roomIdleTimers.delete(roomId);
        console.log(`Room ${roomId} idle timer cleared — player reconnected.`);
      }

      // Update socket ID and clear disconnected flag
      player.id = socket.id;
      player.disconnected = false;
      if (!player.originalId) player.originalId = playerId;

      // Transfer host reference if this player was host
      if (room.host === oldId) {
        room.host = socket.id;
      }

      socket.join(roomId);

      // Notify everyone else that player is back
      io.to(roomId).emit("room_updated", { players: room.players });

      // If game is already in progress, send current state to the rejoining player
      if (room.state) {
        socket.emit("sync_state", { state: room.state });
        console.log(`Sent live game state to reconnecting player ${timerKey} in room ${roomId}.`);
      }

      if (callback) callback({ success: true, players: room.players, gameInProgress: !!room.state });
    });

    socket.on("update_player", (data, callback) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const player = room.players.find(p => p.id === socket.id);
          if (player) {
            if (data.name !== undefined) {
              const otherPlayers = room.players.filter(p => p.id !== socket.id);
              player.name = getUniqueName(sanitizeName(data.name), otherPlayers);
            }
            if (data.avatar !== undefined) {
              const avatarTaken = room.players.some((p: any) => p.id !== socket.id && p.avatar === data.avatar);
              if (avatarTaken) {
                if (callback) callback({ success: false, error: 'Color already taken' });
                return;
              }
              player.avatar = data.avatar;
            }
            io.to(roomId).emit("room_updated", { players: room.players });
            if (callback) callback({ success: true });
          }
        }
      }
    });

    socket.on("start_game", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id) {
          room.state = data.initialState;
          io.to(roomId).emit("game_started", { state: data.initialState });

          // Room is now in-game, remove from public list
          scheduleRoomsListBroadcast();
        }
      }
    });

    socket.on("kick_player", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id && !room.state) {
          const playerIndex = room.players.findIndex(p => p.id === data.playerId);
          if (playerIndex !== -1) {
            const kickedPlayer = room.players[playerIndex];
            room.players.splice(playerIndex, 1);
            io.sockets.sockets.get(kickedPlayer.id)?.leave(roomId);
            io.to(kickedPlayer.id).emit("kicked");
            io.to(roomId).emit("room_updated", { players: room.players });

            // Broadcast updated room list
            scheduleRoomsListBroadcast();
          }
        }
      }
    });

    socket.on("update_settings", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id && !room.state) {
          // Update room-level settings
          if (data.settings?.isPrivate !== undefined) {
            room.isPrivate = data.settings.isPrivate;
          }
          if (data.settings?.maxPlayers !== undefined) {
            room.maxPlayers = data.settings.maxPlayers;
          }
          socket.to(roomId).emit("settings_updated", data.settings);

          // Broadcast updated room list (privacy might have changed)
          scheduleRoomsListBroadcast();
        }
      }
    });

    // BUG-14 FIX: Simple per-socket rate limiter
    const rateLimitMap = new Map<string, number[]>();
    const RATE_LIMIT_MAX = 10;
    const RATE_LIMIT_WINDOW_MS = 1000;
    function isRateLimited(eventKey: string): boolean {
      const now = Date.now();
      const key = `${socket.id}:${eventKey}`;
      const timestamps = rateLimitMap.get(key) || [];
      const filtered = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (filtered.length >= RATE_LIMIT_MAX) {
        rateLimitMap.set(key, filtered);
        return true;
      }
      filtered.push(now);
      rateLimitMap.set(key, filtered);
      return false;
    }

    socket.on("send_chat", (data) => {
      if (isRateLimited('chat')) return;
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        io.to(roomId).emit("chat_message", data);
      }
    });

    socket.on("game_action", (data) => {
      if (isRateLimited('action')) return;
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const isPlayer = room.players.some((p: any) => p.id === socket.id);
          if (!isPlayer) return;
          io.to(room.host).emit("host_process_action", { ...data, _senderId: socket.id });
        }
      }
    });

    socket.on("sync_state", (data) => {
      const MAX_STATE_SIZE = 512 * 1024; // 512 KB — B5: reject oversized payloads
      if (!data?.state || JSON.stringify(data.state).length > MAX_STATE_SIZE) return;
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id) {
          room.state = data.state; // store full state for reconnects
          // Trim logs to last 50 entries before broadcasting — keeps payload small
          const broadcastState = Array.isArray(data.state.logs) && data.state.logs.length > 50
            ? { ...data.state, logs: data.state.logs.slice(-50) }
            : data.state;
          socket.to(roomId).emit("sync_state", { state: broadcastState });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          const timerKey = player.originalId || player.id;

          if (!room.state) {
            // Game hasn't started — remove immediately so rejoining player keeps original name
            room.players.splice(playerIndex, 1);
            if (room.players.length === 0) {
              rooms.delete(roomId);
            } else {
              if (room.host === player.id) {
                const next = room.players.find((p: any) => !p.disconnected) || room.players[0];
                room.host = next.id;
                next.isHost = true;
                room.hostName = next.name || 'Player';
              }
              io.to(roomId).emit("room_updated", { players: room.players });
            }
            scheduleRoomsListBroadcast();
            console.log(`Player ${timerKey} removed immediately from lobby ${roomId} (game not started).`);
          } else {
            // Game in progress — soft-disconnect with reconnect window
            player.disconnected = true;
            player.disconnectedAt = Date.now(); // I5: client uses this for 2-min countdown UI
            console.log(`Player ${timerKey} disconnected from room ${roomId}. Starting ${RECONNECT_WINDOW_MS / 60000}-min reconnect window.`);

            // Notify others that this player temporarily disconnected
            io.to(roomId).emit("room_updated", { players: room.players });
            scheduleRoomsListBroadcast();

            // Schedule permanent removal after the reconnect window
            const timer = setTimeout(() => {
              permanentlyRemovePlayer(roomId, timerKey);
            }, RECONNECT_WINDOW_MS);
            disconnectTimers.set(timerKey, timer);

            // If ALL players are now disconnected, start a room-level idle timer
            const allDisconnected = room.players.every((p: any) => p.disconnected);
            if (allDisconnected && !roomIdleTimers.has(roomId)) {
              console.log(`All players disconnected from room ${roomId}. Room will persist for ${ROOM_IDLE_TTL / 60000} min.`);
              const idleTimer = setTimeout(() => {
                rooms.delete(roomId);
                roomIdleTimers.delete(roomId);
                console.log(`Room ${roomId} deleted after idle TTL (all players disconnected).`);
              }, ROOM_IDLE_TTL);
              roomIdleTimers.set(roomId, idleTimer);
            }
          }

          return; // player found in a room — done
        }
      }
      // Not in any room — just update the list
      scheduleRoomsListBroadcast();
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await import("vite");
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    const path = await import("path");
    const distPath = path.default.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback: serve index.html for all non-API routes
    app.use((req, res) => {
      res.sendFile(path.default.resolve(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
