import express from "express";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import { randomBytes, randomUUID } from "crypto";

interface RoomData {
  host: string;
  hostName: string;
  players: any[];
  state: any;
  isPrivate: boolean;
  maxPlayers: number;
  createdAt: number;
}

// Dev-only logger — silent in production
const isDev = process.env.NODE_ENV !== 'production';
const log = isDev ? (...args: any[]) => console.log(...args) : () => {};

async function startServer() {
  // ── Startup env validation ──────────────────────────────────────────────────
  const missingCritical: string[] = [];
  if (!process.env.ADMIN_TOKEN)    console.warn('[WARN] ADMIN_TOKEN not set — admin endpoints are unprotected');
  if (!process.env.ADMIN_USERNAME) console.warn('[WARN] ADMIN_USERNAME not set — admin login uses insecure default');
  if (!process.env.ADMIN_PASSWORD) console.warn('[WARN] ADMIN_PASSWORD not set — admin login uses insecure default');
  if (missingCritical.length) {
    console.error('[FATAL] Missing required env vars:', missingCritical.join(', '));
    process.exit(1);
  }

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = createHttpServer(app);
  // SEC-01: Restrict CORS to known origins; fall back to wildcard only in dev
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : null;
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins
        ? (allowedOrigins.length === 1 && allowedOrigins[0] === '*' ? '*' : allowedOrigins)
        : true,
      methods: ["GET", "POST"]
    }
  });

  // Supabase + DB — only loaded when DATABASE_URL is configured
  const hasDB = !!process.env.DATABASE_URL;
  let supabaseAdmin: any = null;
  let db: any = null;
  let schema: any = null;
  let eq: any = null;
  let and: any = null;
  let or: any = null;
  let inArray: any = null;
  let ilike: any = null;

  if (hasDB) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      supabaseAdmin = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      db = (await import("./db/index")).db;
      schema = await import("./db/schema");
      const drizzle = await import("drizzle-orm");
      eq = drizzle.eq;
      and = drizzle.and;
      or = drizzle.or;
      inArray = drizzle.inArray;
      ilike = drizzle.ilike;
      log("Supabase + DB loaded");
    } catch (e: any) {
      console.error("Failed to load supabase/db — running without auth:", e?.message);
    }
  } else {
    console.warn("DATABASE_URL not set — auth and store routes disabled");
  }

  // ── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json());

  // Serve audio assets from cashly_assets/sounds at /sounds
  const pathModule = await import("path");
  app.use("/sounds", express.static(
    pathModule.default.resolve(process.cwd(), "cashly_assets/sounds")
  ));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ─── Admin ─────────────────────────────────────────────────────────────────
  const ADMIN_TOKEN    = process.env.ADMIN_TOKEN    || '';
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
  const adminBoards = new Map<string, any>();
  let activeAdminBoard: any = null;

  function requireAdmin(req: any, res: any, next: any) {
    if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  app.post('/api/admin/login', (req, res) => {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_TOKEN) {
      return res.status(503).json({ success: false, error: 'Admin access not configured on this server.' });
    }
    const { username, password } = req.body || {};
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      res.json({ success: true, token: ADMIN_TOKEN });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  });

  app.get('/api/admin/boards', requireAdmin, (_req, res) => {
    res.json({ boards: Array.from(adminBoards.values()), activeBoard: activeAdminBoard });
  });

  app.post('/api/admin/boards', requireAdmin, (req, res) => {
    const board = { ...req.body, id: randomUUID(), createdAt: Date.now() };
    adminBoards.set(board.id, board);
    res.json({ success: true, board });
  });

  app.put('/api/admin/boards/:id', requireAdmin, (req, res) => {
    const existing = adminBoards.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Board not found' });
    const updated = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt };
    adminBoards.set(existing.id, updated);
    if (activeAdminBoard?.id === existing.id) activeAdminBoard = updated;
    res.json({ success: true, board: updated });
  });

  app.delete('/api/admin/boards/:id', requireAdmin, (req, res) => {
    adminBoards.delete(req.params.id);
    if (activeAdminBoard?.id === req.params.id) activeAdminBoard = null;
    res.json({ success: true });
  });

  app.post('/api/admin/boards/:id/push', requireAdmin, (req, res) => {
    const board = adminBoards.get(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    activeAdminBoard = board;
    io.emit('admin_board_pushed', { board });
    log(`Admin pushed board "${board.name}" to all clients.`);
    res.json({ success: true });
  });

  // Public — clients fetch active board on page load / before starting game
  app.get('/api/active-board', (_req, res) => {
    res.json({ board: activeAdminBoard });
  });

  // Per-IP rate limit for AI advice (5 req/min)
  const aiRateLimitMap = new Map<string, number[]>();
  function isAIRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = aiRateLimitMap.get(ip) || [];
    const filtered = timestamps.filter(t => now - t < 60000);
    if (filtered.length >= 5) { aiRateLimitMap.set(ip, filtered); return true; }
    filtered.push(now);
    aiRateLimitMap.set(ip, filtered);
    return false;
  }

  // SEC-07: Gemini API key is never sent to the client — all AI calls go through this proxy.
  // ERR-02: Use gemini-2.0-flash (correct model name).
  app.post("/api/ai-advice", async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '');
    if (isAIRateLimited(ip)) return res.status(429).json({ advice: "Too many requests. Please wait a moment." });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ advice: "AI advisor is not configured on this server." });
    }
    try {
      const { context } = req.body || {};
      if (!context) return res.status(400).json({ advice: "Missing context." });

      const prompt = `You are a Monopoly expert advisor.
Game State:
- Current Player: ${context.playerName} (Cash: $${context.playerMoney})
- Position: ${context.tileName} (Type: ${context.tileType}, Price: $${context.tilePrice}, Owned By: ${context.tileOwnerId ?? 'None'})
- My Properties: ${context.myPropertyCount}
- Opponents: ${(context.opponents || []).map((p: any) => `${p.name} ($${p.money})`).join(', ')}

Advice needed on what to do (Buy? Pass? Trade strategy?).
Keep it very short (under 30 words), punchy, and strategic.`;

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      res.json({ advice: response.text || "No advice generated." });
    } catch (err: any) {
      console.error("AI advice error:", err?.message);
      res.status(500).json({ advice: "Unable to reach the advisor. Please try again." });
    }
  });

  // SEC-02: Simple per-IP rate limiter for join endpoints (10 req/min)
  const joinRateLimitMap = new Map<string, number[]>();
  function isJoinRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = joinRateLimitMap.get(ip) || [];
    const filtered = timestamps.filter(t => now - t < 60000);
    if (filtered.length >= 10) {
      joinRateLimitMap.set(ip, filtered);
      return true;
    }
    filtered.push(now);
    joinRateLimitMap.set(ip, filtered);
    return false;
  }

  const rooms = new Map<string, RoomData>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>(); // keyed by originalPlayerId
  const roomIdleTimers = new Map<string, NodeJS.Timeout>(); // keyed by roomId — fires when all players disconnected

  // Debounced rooms_list broadcast — collapses bursts of calls into one emit per 50ms
  let roomsListFlushTimer: NodeJS.Timeout | null = null;
  function scheduleRoomsListBroadcast() {
    if (roomsListFlushTimer) return;
    roomsListFlushTimer = setTimeout(() => {
      roomsListFlushTimer = null;
      io.emit('rooms_list', getPublicRoomsList());
    }, 50);
  }
  const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes per-player reconnect window
  const ROOM_IDLE_TTL = 10 * 60 * 1000; // 10 minutes — room deleted if all players disconnected

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
        // MEM-02: Also cancel the idle timer if GC fires before it does
        if (roomIdleTimers.has(roomId)) {
          clearTimeout(roomIdleTimers.get(roomId)!);
          roomIdleTimers.delete(roomId);
        }
        rooms.delete(roomId);
        log(`GC: deleted stale room ${roomId} (all disconnected > 1hr)`);
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
      // Match by name since game state uses numeric IDs, not socket IDs
      if (room.state && room.state.players) {
        const removedRoomPlayer = room.players.find((p: any) => (p.originalId || p.id) === originalPlayerId);
        if (removedRoomPlayer) {
          // B6 FIX: Match by gamePlayerId from the map built at start_game, fall back to name only if map is missing
          const mappedGamePlayerId = room.socketToGamePlayerId?.[originalPlayerId];
          const removedGamePlayer = mappedGamePlayerId != null
            ? room.state.players.find((p: any) => p.id === mappedGamePlayerId)
            : room.state.players.find((p: any) => p.name === removedRoomPlayer.name);
          const currentGamePlayer = room.state.players[room.state.currentPlayerIndex];
          if (removedGamePlayer && currentGamePlayer && removedGamePlayer.id === currentGamePlayer.id) {
            io.to(room.host).emit("host_process_action", {
              type: 'FORCE_END_TURN',
              payload: { removedPlayerId: originalPlayerId },
            });
          }
        }
      }
    }
    scheduleRoomsListBroadcast();
    log(`Player ${originalPlayerId} permanently removed from room ${roomId} (reconnect window expired).`);
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
    // SEC-08/09: Use CSPRNG for IDs instead of Math.random()
    const roomId = randomBytes(3).toString('hex').toUpperCase();
    const playerId = "p_" + randomUUID().replace(/-/g, '').slice(0, 16);
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
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '');
    if (isJoinRateLimited(ip)) {
      return res.status(429).json({ success: false, error: "Too many requests. Please wait." });
    }
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
      const playerId = "p_" + randomUUID().replace(/-/g, '').slice(0, 16);
      const uniqueName = getUniqueName(sanitizeName(data.name), room.players);
      const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false };
      room.players.push(player);
      // We don't broadcast room_updated here because socket isn't connected yet.
      // We will broadcast when they actually connect their socket.
      res.json({ success: true, roomId: targetRoomId, playerId, players: room.players });
    } else {
      // Create a new room
      const roomId = randomBytes(3).toString('hex').toUpperCase();
      const playerId = "p_" + randomUUID().replace(/-/g, '').slice(0, 16);
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
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '');
    if (isJoinRateLimited(ip)) {
      return res.status(429).json({ success: false, error: "Too many requests. Please wait." });
    }
    const roomId = req.params.id.trim().toUpperCase();
    const data = req.body;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    if (room.state) {
      const playerId = "p_" + randomUUID().replace(/-/g, '').slice(0, 16);
      const uniqueName = getUniqueName(sanitizeName(data.name), room.players);
      const realPlayers = room.players.filter((p: any) => !p.isSpectator);
      const allDisconnected = realPlayers.length > 0 && realPlayers.every((p: any) => p.disconnected);
      if (allDisconnected) {
        // All game players are gone — new joiner becomes host so they can control/restart
        room.players.forEach((p: any) => { p.isHost = false; });
        const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: true };
        room.players.push(player);
        room.host = playerId; // updated to socket.id on join_session
        room.hostName = uniqueName;
        // Cancel idle timer — someone is joining
        if (roomIdleTimers.has(roomId)) {
          clearTimeout(roomIdleTimers.get(roomId)!);
          roomIdleTimers.delete(roomId);
        }
        res.json({ success: true, roomId, playerId, players: room.players, isSpectator: false, becameHost: true });
      } else {
        // Game in progress with active players — join as spectator
        const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false, isSpectator: true };
        room.players.push(player);
        res.json({ success: true, roomId, playerId, players: room.players, isSpectator: true });
      }
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ success: false, error: "Room is full" });
    }

    const playerId = "p_" + randomUUID().replace(/-/g, '').slice(0, 16);
    const uniqueName = getUniqueName(sanitizeName(data.name), room.players);
    const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false };
    room.players.push(player);

    scheduleRoomsListBroadcast();
    res.json({ success: true, roomId: roomId, playerId, players: room.players });
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    log("Client connected:", socket.id);

    // Initial connection linking REST session to Socket
    socket.on("join_session", (data, callback) => {
      const { playerId } = data;
      const roomId = data.roomId?.trim().toUpperCase();
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("session_rejected", { error: "Room not found" });
        if (callback) callback({ success: false, error: "Room not found" });
        return;
      }

      // Search by originalId first (handles reconnects after socket ID change)
      // then fall back to current id (first-time connection)
      const playerIndex = room.players.findIndex((p: any) =>
        p.originalId === playerId || p.id === playerId
      );

      if (playerIndex === -1) {
        socket.emit("session_rejected", { error: "Player session not found in room" });
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
        log(`Player ${timerKey} reconnected to room ${roomId}. Disconnect timer cleared.`);
      }
      // Clear room-level idle timer if someone is reconnecting
      if (roomIdleTimers.has(roomId)) {
        clearTimeout(roomIdleTimers.get(roomId)!);
        roomIdleTimers.delete(roomId);
        log(`Room ${roomId} idle timer cleared — player reconnected.`);
      }

      // Update socket ID and clear disconnected flag
      player.id = socket.id;
      player.disconnected = false;
      if (!player.originalId) player.originalId = playerId;

      // Transfer host reference if this player was host
      if (room.host === oldId) {
        room.host = socket.id;
        player.isHost = true; // ensure flag matches host status
      }

      socket.join(roomId);

      // Auto-promote: if the room's host slot has no active player (stale id, disconnected,
      // or a zombie player whose socket never completed join_session), promote this player.
      const currentHostPlayer = room.players.find((p: any) => p.id === room.host);
      const hostSocketActive = io.sockets.sockets.has(room.host);
      if (!currentHostPlayer || currentHostPlayer.disconnected || !hostSocketActive) {
        room.players.forEach((p: any) => { p.isHost = false; });
        player.isHost = true;
        room.host = socket.id;
        room.hostName = player.name || 'Player';
        socket.emit("you_are_host");
      } else if (player.isSpectator) {
        // NEW-JOIN: Spectator joining an all-disconnected in-game room gets promoted to host
        const realPlayers = room.players.filter((p: any) => !p.isSpectator && p.id !== socket.id);
        const allDisconnected = realPlayers.length > 0 && realPlayers.every((p: any) => p.disconnected);
        if (allDisconnected) {
          player.isSpectator = false;
          room.players.forEach((p: any) => { p.isHost = false; });
          player.isHost = true;
          room.host = socket.id;
          room.hostName = player.name || 'Player';
          socket.emit("you_are_host");
          log(`New player ${player.name} promoted to host in abandoned room ${roomId}.`);
        }
      }

      // Notify everyone that player is back (with updated host flags)
      io.to(roomId).emit("room_updated", { players: room.players });

      // If game is already in progress, send current state to the rejoining player
      if (room.state) {
        socket.emit("sync_state", { state: room.state });
        log(`Sent live game state to reconnecting player ${timerKey} in room ${roomId}.`);
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
          // B6 FIX: Build socket→gamePlayerId map at game-start using name matching (names are unique at this point)
          if (data.initialState?.players && Array.isArray(data.initialState.players)) {
            room.socketToGamePlayerId = {};
            for (const rp of room.players) {
              const socketKey = rp.originalId || rp.id;
              const gp = data.initialState.players.find((g: any) => g.name === rp.name);
              if (gp) room.socketToGamePlayerId[socketKey] = gp.id;
            }
          }
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

    // NET-05: Intentional leave — immediately frees the player slot without waiting for reconnect window
    socket.on("leave_room", () => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
      if (playerIndex === -1) return;
      const player = room.players[playerIndex];
      const timerKey = player.originalId || player.id;
      // Cancel any pending reconnect timer for this player
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey)!);
        disconnectTimers.delete(timerKey);
      }
      room.players.splice(playerIndex, 1);
      socket.leave(roomId);
      if (room.players.length === 0) {
        rooms.delete(roomId);
      } else {
        if (room.host === player.id) {
          const next = room.players.find((p: any) => !p.disconnected) || room.players[0];
          room.host = next.id;
          next.isHost = true;
          room.hostName = next.name || 'Player';
          io.to(next.id).emit("you_are_host");
        }
        io.to(roomId).emit("room_updated", { players: room.players });
      }
      scheduleRoomsListBroadcast();
    });

    socket.on("send_chat", (data) => {
      if (isRateLimited('chat')) return;
      // NET-07: Reject oversized or malformed chat messages
      if (typeof data?.text !== 'string' || data.text.length > 500) return;
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        // BUG-19: Look up sender name server-side to prevent client impersonation
        const room = rooms.get(roomId);
        if (!room) return;
        const chatPlayer = room.players.find((p: any) => p.id === socket.id);
        if (!chatPlayer) return;
        io.to(roomId).emit("chat_message", { sender: chatPlayer.name, text: data.text, time: data.time });
      }
    });

    // SEC-05: Allowlist of action types non-host players may submit
    const PLAYER_ALLOWED_ACTIONS = new Set([
      'ROLL_DICE', 'BUY_PROPERTY', 'ATTEMPT_JAIL_ROLL', 'SKIP_JAIL_TURN', 'PAY_JAIL_FINE',
      'MORTGAGE_PROPERTY', 'UNMORTGAGE_PROPERTY', 'UPGRADE_PROPERTY', 'DOWNGRADE_PROPERTY', 'SELL_PROPERTY',
      'PROPOSE_TRADE', 'ACCEPT_TRADE', 'DECLINE_TRADE', 'CANCEL_TRADE',
      'PLACE_BID', 'END_TURN', 'DECLARE_BANKRUPT',
      'VOTE_KICK', 'CANCEL_VOTE_KICK',
    ]);

    socket.on("game_action", (data) => {
      if (isRateLimited('action')) {
        socket.emit("action_error", { error: "Too many actions — slow down" });
        return;
      }
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const isPlayer = room.players.some((p: any) => p.id === socket.id);
          if (!isPlayer) {
            socket.emit("action_error", { error: "Not a player in this room" });
            return;
          }
          // SEC-05: Reject unknown/dangerous action types before forwarding to host
          if (!data?.type || !PLAYER_ALLOWED_ACTIONS.has(data.type)) {
            socket.emit("action_error", { error: `Action '${data?.type}' is not allowed` });
            return;
          }
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
      log("Client disconnected:", socket.id);
      // MEM-01: Clean up rate-limit entries for this socket to prevent unbounded growth
      for (const key of rateLimitMap.keys()) {
        if (key.startsWith(socket.id + ':')) rateLimitMap.delete(key);
      }
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
            log(`Player ${timerKey} removed immediately from lobby ${roomId} (game not started).`);
          } else {
            // Game in progress — soft-disconnect with reconnect window
            player.disconnected = true;
            player.disconnectedAt = Date.now(); // I5: client uses this for 2-min countdown UI
            log(`Player ${timerKey} disconnected from room ${roomId}. Starting ${RECONNECT_WINDOW_MS / 60000}-min reconnect window.`);

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
              log(`All players disconnected from room ${roomId}. Room will persist for ${ROOM_IDLE_TTL / 60000} min.`);
              const idleTimer = setTimeout(() => {
                rooms.delete(roomId);
                roomIdleTimers.delete(roomId);
                log(`Room ${roomId} deleted after idle TTL (all players disconnected).`);
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

  // ─── Store API (only when DB is available) ───────────────────────────────────
  if (hasDB && db) {

  // Helper: get authed user from request (reads Bearer token set by authFetch)
  async function getSessionUser(req: any) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  }

  app.get('/api/store/items', async (_req, res) => {
    try {
      const items = await db.select().from(schema.storeItem).where(eq(schema.storeItem.active, true));
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load store items' });
    }
  });

  app.get('/api/store/inventory/:userId', async (req, res) => {
    try {
      const purchases = await db
        .select({ itemId: schema.purchase.itemId })
        .from(schema.purchase)
        .where(eq(schema.purchase.userId, req.params.userId));
      const [userData] = await db.select({ coins: schema.profiles.coins }).from(schema.profiles).where(eq(schema.profiles.id, req.params.userId));
      res.json({ itemIds: purchases.map(p => p.itemId), coins: userData?.coins ?? 0 });
    } catch {
      res.status(500).json({ error: 'Failed to load inventory' });
    }
  });

  app.post('/api/store/purchase', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });

    const { itemId } = req.body ?? {};
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    try {
      // Load item
      const [item] = await db.select().from(schema.storeItem).where(and(eq(schema.storeItem.id, itemId), eq(schema.storeItem.active, true)));
      if (!item) return res.status(404).json({ error: 'Item not found' });

      // Load user coins
      const [userData] = await db.select({ coins: schema.profiles.coins }).from(schema.profiles).where(eq(schema.profiles.id, sessionUser.id));
      if (!userData) return res.status(404).json({ error: 'User not found' });

      if (userData.coins < item.priceCoins) return res.status(400).json({ error: 'Insufficient coins' });

      // Check not already owned
      const [existing] = await db.select().from(schema.purchase).where(and(eq(schema.purchase.userId, sessionUser.id), eq(schema.purchase.itemId, itemId)));
      if (existing) return res.status(400).json({ error: 'Already owned' });

      // Deduct coins + record purchase (in parallel)
      const newCoins = userData.coins - item.priceCoins;
      await Promise.all([
        db.update(schema.profiles).set({ coins: newCoins }).where(eq(schema.profiles.id, sessionUser.id)),
        db.insert(schema.purchase).values({ id: randomUUID(), userId: sessionUser.id, itemId, purchasedAt: new Date() }),
      ]);

      res.json({ success: true, coins: newCoins });
    } catch (err: any) {
      console.error('Purchase error:', err?.message);
      res.status(500).json({ error: 'Purchase failed' });
    }
  });

  // ─── Admin: User Management ───────────────────────────────────────────────────

  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await db.select({
        id: schema.profiles.id, name: schema.profiles.name, email: schema.profiles.email, role: schema.profiles.role,
        banned: schema.profiles.banned, banReason: schema.profiles.banReason, createdAt: schema.profiles.createdAt, coins: schema.profiles.coins,
      }).from(schema.profiles);
      res.json({ users });
    } catch {
      res.status(500).json({ error: 'Failed to load users' });
    }
  });

  app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const { role, banned, banReason, coins } = req.body ?? {};
    const updates: Record<string, any> = {};
    if (role !== undefined) updates.role = role;
    if (banned !== undefined) updates.banned = banned;
    if (banReason !== undefined) updates.banReason = banReason;
    if (coins !== undefined) updates.coins = coins;
    try {
      await db.update(schema.profiles).set(updates).where(eq(schema.profiles.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // ─── Admin: Store Management ──────────────────────────────────────────────────

  app.get('/api/admin/store/items', requireAdmin, async (_req, res) => {
    try {
      const items = await db.select().from(schema.storeItem);
      res.json({ items });
    } catch {
      res.status(500).json({ error: 'Failed to load store items' });
    }
  });

  app.post('/api/admin/store/items', requireAdmin, async (req, res) => {
    const { name, description, type, priceCoins, assetUrl } = req.body ?? {};
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });
    try {
      const item = {
        id: randomUUID(), name, description: description ?? '',
        type, priceCoins: priceCoins ?? 100, assetUrl: assetUrl ?? null,
        active: true, createdAt: new Date(),
      };
      await db.insert(schema.storeItem).values(item);
      res.json({ success: true, item });
    } catch {
      res.status(500).json({ error: 'Failed to create item' });
    }
  });

  app.patch('/api/admin/store/items/:id', requireAdmin, async (req, res) => {
    const { name, description, type, priceCoins, assetUrl, active } = req.body ?? {};
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (priceCoins !== undefined) updates.priceCoins = priceCoins;
    if (assetUrl !== undefined) updates.assetUrl = assetUrl;
    if (active !== undefined) updates.active = active;
    try {
      await db.update(schema.storeItem).set(updates).where(eq(schema.storeItem.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update item' });
    }
  });

  app.delete('/api/admin/store/items/:id', requireAdmin, async (req, res) => {
    try {
      await db.update(schema.storeItem).set({ active: false }).where(eq(schema.storeItem.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete item' });
    }
  });

  // ─── Profile ──────────────────────────────────────────────────────────────

  app.get('/api/profile/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const users = await db.select().from(schema.profiles).where(eq(schema.profiles.id, userId));
      if (!users.length) return res.status(404).json({ error: 'User not found' });
      const u = users[0];
      const statsList = await db.select().from(schema.profilesStats).where(eq(schema.profilesStats.userId, userId));
      const stats = statsList[0] ?? { gamesPlayed: 0, gamesWon: 0, totalEarnings: 0, propertiesBought: 0 };
      res.json({ id: u.id, name: u.name, email: u.email, image: u.image, coins: u.coins, createdAt: u.createdAt, stats });
    } catch {
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  app.post('/api/profile/stats', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    const {
      gamesPlayed = 0, gamesWon = 0, gamesLost = 0,
      totalEarnings = 0, propertiesBought = 0,
      peakPropertiesOwned = 0, bankruptcies = 0, totalTurns = 0,
    } = req.body ?? {};
    try {
      const existing = await db.select().from(schema.profilesStats).where(eq(schema.profilesStats.userId, sessionUser.id));
      if (existing.length) {
        const e = existing[0];
        await db.update(schema.profilesStats).set({
          gamesPlayed:         e.gamesPlayed + gamesPlayed,
          gamesWon:            e.gamesWon + gamesWon,
          gamesLost:           e.gamesLost + gamesLost,
          totalEarnings:       e.totalEarnings + totalEarnings,
          propertiesBought:    e.propertiesBought + propertiesBought,
          peakPropertiesOwned: Math.max(e.peakPropertiesOwned, peakPropertiesOwned),
          bankruptcies:        e.bankruptcies + bankruptcies,
          totalTurns:          e.totalTurns + totalTurns,
          updatedAt:           new Date(),
        }).where(eq(schema.profilesStats.userId, sessionUser.id));
      } else {
        await db.insert(schema.profilesStats).values({
          userId: sessionUser.id, gamesPlayed, gamesWon, gamesLost,
          totalEarnings, propertiesBought, peakPropertiesOwned, bankruptcies, totalTurns,
          updatedAt: new Date(),
        });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update stats' });
    }
  });

  // ── Profile edit ─────────────────────────────────────────────────────────────
  app.patch('/api/profile', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    const { name, image } = req.body ?? {};
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name && typeof name === 'string') updates.name = name.trim().slice(0, 40);
    if (image && typeof image === 'string') updates.image = image;
    try {
      await db.update(schema.profiles).set(updates).where(eq(schema.profiles.id, sessionUser.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // ── Friends ───────────────────────────────────────────────────────────────────
  app.get('/api/friends', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const rows = await db.select().from(schema.friendships).where(
        and(
          eq(schema.friendships.status, 'accepted'),
          or(
            eq(schema.friendships.requesterId, sessionUser.id),
            eq(schema.friendships.addresseeId, sessionUser.id)
          )
        )
      );
      const friendIds = rows.map(r => r.requesterId === sessionUser.id ? r.addresseeId : r.requesterId);
      if (!friendIds.length) return res.json({ friends: [] });
      const friends = await db.select({ id: schema.profiles.id, name: schema.profiles.name, image: schema.profiles.image })
        .from(schema.profiles).where(inArray(schema.profiles.id, friendIds));
      res.json({ friends });
    } catch {
      res.status(500).json({ error: 'Failed to load friends' });
    }
  });

  app.get('/api/friends/requests', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const rows = await db.select().from(schema.friendships).where(
        and(eq(schema.friendships.addresseeId, sessionUser.id), eq(schema.friendships.status, 'pending'))
      );
      if (!rows.length) return res.json({ requests: [] });
      const requesterIds = rows.map(r => r.requesterId);
      const requesters = await db.select({ id: schema.profiles.id, name: schema.profiles.name, image: schema.profiles.image })
        .from(schema.profiles).where(inArray(schema.profiles.id, requesterIds));
      const requests = rows.map(r => ({
        friendshipId: r.id,
        user: requesters.find(u => u.id === r.requesterId),
      }));
      res.json({ requests });
    } catch {
      res.status(500).json({ error: 'Failed to load friend requests' });
    }
  });

  app.post('/api/friends/request', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    const { addresseeId } = req.body ?? {};
    if (!addresseeId || addresseeId === sessionUser.id) return res.status(400).json({ error: 'Invalid addressee' });
    try {
      const existing = await db.select().from(schema.friendships).where(
        or(
          and(eq(schema.friendships.requesterId, sessionUser.id), eq(schema.friendships.addresseeId, addresseeId)),
          and(eq(schema.friendships.requesterId, addresseeId), eq(schema.friendships.addresseeId, sessionUser.id))
        )
      );
      if (existing.length) return res.status(400).json({ error: 'Friendship already exists' });
      await db.insert(schema.friendships).values({ requesterId: sessionUser.id, addresseeId });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  });

  app.post('/api/friends/respond', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    const { friendshipId, status } = req.body ?? {};
    if (!friendshipId || !['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid' });
    try {
      await db.update(schema.friendships).set({ status, updatedAt: new Date() })
        .where(and(eq(schema.friendships.id, friendshipId), eq(schema.friendships.addresseeId, sessionUser.id)));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to respond to request' });
    }
  });

  app.delete('/api/friends/:friendId', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    try {
      await db.delete(schema.friendships).where(
        and(
          or(
            and(eq(schema.friendships.requesterId, sessionUser.id), eq(schema.friendships.addresseeId, req.params.friendId)),
            and(eq(schema.friendships.requesterId, req.params.friendId), eq(schema.friendships.addresseeId, sessionUser.id))
          ),
          eq(schema.friendships.status, 'accepted')
        )
      );
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  });

  app.get('/api/users/search', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    const q = (req.query.q as string ?? '').trim();
    if (q.length < 2) return res.json({ users: [] });
    try {
      const users = await db.select({ id: schema.profiles.id, name: schema.profiles.name, image: schema.profiles.image })
        .from(schema.profiles)
        .where(ilike(schema.profiles.name, `%${q}%`))
        .limit(10);
      res.json({ users: users.filter(u => u.id !== sessionUser.id) });
    } catch {
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  } // end if (hasDB && db)

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
    log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
