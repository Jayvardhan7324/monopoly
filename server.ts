import express from "express";
import compression from "compression";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { PLAYER_ALLOWED_ACTIONS } from "./services/actionPolicy";

// Actions that may only be submitted by the player whose turn it currently is.
// Everything else in PLAYER_ALLOWED_ACTIONS (trades, auction bids, vote-kicks)
// is valid off-turn and is not gated here.
const OWN_TURN_ONLY_ACTIONS = new Set<string>([
  'ROLL_DICE',
  'BUY_PROPERTY',
  'ATTEMPT_JAIL_ROLL',
  'SKIP_JAIL_TURN',
  'PAY_JAIL_FINE',
  'MORTGAGE_PROPERTY',
  'UNMORTGAGE_PROPERTY',
  'UPGRADE_PROPERTY',
  'DOWNGRADE_PROPERTY',
  'SELL_PROPERTY',
  'END_TURN',
  'DECLARE_BANKRUPT',
]);

interface RoomData {
  host: string;
  hostName: string;
  players: any[];
  state: any;
  isPrivate: boolean;
  maxPlayers: number;
  createdAt: number;
  socketToGamePlayerId?: Record<string, number>;
}

// Dev-only logger — silent in production
const isDev = process.env.NODE_ENV !== 'production';
const log = isDev ? (...args: any[]) => console.log(...args) : () => {};

async function startServer() {
  // ── Startup env validation ──────────────────────────────────────────────────
  const isProd = process.env.NODE_ENV === 'production';
  const missingCritical: string[] = [];
  if (!process.env.DATABASE_URL)              missingCritical.push('DATABASE_URL');
  if (!process.env.BETTER_AUTH_SECRET)        missingCritical.push('BETTER_AUTH_SECRET');
  if (missingCritical.length) {
    console.error('[FATAL] Missing required env vars:', missingCritical.join(', '));
    process.exit(1);
  }
  if (!process.env.ADMIN_TOKEN || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.warn('[WARN] Admin panel disabled — required configuration missing');
  }
  if (isProd && !process.env.ALLOWED_ORIGINS) {
    console.warn('[WARN] ALLOWED_ORIGINS not set in production — Socket.io will accept connections from any origin');
  }

  const app = express();
  // SEC-04: Trust first proxy hop so req.ip reflects real client IP (used for rate limiting)
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = createHttpServer(app);
  // SEC-01: Restrict CORS to known origins; fall back to wildcard only in dev
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : null;
  const originAllowlistActive = !!allowedOrigins && !(allowedOrigins.length === 1 && allowedOrigins[0] === '*');
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins
        ? (originAllowlistActive ? allowedOrigins : '*')
        : true,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // SEC: Cap per-frame payload (default 1MB) — sync_state already enforces 512KB at the handler level.
    maxHttpBufferSize: 600 * 1024,
    // SEC: Reject handshakes from origins outside ALLOWED_ORIGINS in production. Non-browser
    // clients (no Origin header) are still allowed so server-to-server health checks work.
    allowRequest: (req, cb) => {
      if (!originAllowlistActive) return cb(null, true);
      const origin = (req.headers.origin as string) || '';
      if (!origin) return cb(null, true);
      return cb(null, allowedOrigins!.includes(origin));
    },
  });

  // Better Auth + DB — only loaded when DATABASE_URL is configured
  const hasDB = !!process.env.DATABASE_URL;
  let auth: any = null;
  let fromNodeHeaders: any = null;
  let db: any = null;
  let schema: any = null;
  let eq: any = null;
  let and: any = null;
  let or: any = null;
  let sql: any = null;
  let inArray: any = null;
  let ilike: any = null;

  if (hasDB) {
    try {
      db = (await import("./db/index")).db;
      schema = await import("./db/schema");
      const drizzle = await import("drizzle-orm");
      eq = drizzle.eq;
      and = drizzle.and;
      or = drizzle.or;
      sql = drizzle.sql;
      inArray = drizzle.inArray;
      ilike = drizzle.ilike;
      auth = (await import("./lib/auth")).auth;
      const nodeHelpers = await import("better-auth/node");
      fromNodeHeaders = nodeHelpers.fromNodeHeaders;
      // Better Auth handler MUST be mounted before express.json() —
      // toNodeHandler consumes the raw request body itself.
      app.all(/^\/api\/auth\/.*/, nodeHelpers.toNodeHandler(auth));
      log("Better Auth + DB loaded");
    } catch (e: any) {
      console.error("Failed to load better-auth/db — running without auth:", e?.message);
    }
  } else {
    console.warn("DATABASE_URL not set — auth and store routes disabled");
  }

  // Gzip/brotli compress all responses
  app.use(compression());

  // ── Security headers ────────────────────────────────────────────────────────
  // Build a CSP that covers this app's surface: React bundle (self), inline styles (Tailwind
  // CSS-in-JS + shadcn animate plugins), socket.io over ws/wss, images from self/https/data,
  // Google/Apple/Discord OAuth popups, and nothing else. Ad HTML snippets are rendered inside
  // a sandboxed iframe in AdSlot, so we don't need to allow 'unsafe-inline' scripts globally.
  const cspConnect = ["'self'", 'ws:', 'wss:', 'https:'];
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'" + (isProd ? "" : " 'unsafe-eval'"),
    "script-src-attr 'none'",
    `connect-src ${cspConnect.join(' ')}`,
    "media-src 'self' https: data:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join('; ');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Content-Security-Policy', cspDirectives);
    if (isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    next();
  });

  // SEC: Cap JSON body size. Admin board saves can be a few hundred KB (tiles jsonb), so 256KB
  // is the generous upper bound. Anything larger is almost certainly abuse.
  app.use(express.json({ limit: '256kb' }));

  // Serve audio assets from cashly_assets/sounds at /sounds
  const pathModule = await import("path");
  app.use("/sounds", express.static(
    pathModule.default.resolve(process.cwd(), "cashly_assets/sounds")
  ));
  // Serve project assets (SVGs, images) at /assets
  app.use("/assets", express.static(
    pathModule.default.resolve(process.cwd(), "assets")
  ));

  app.get("/api/health", async (_req, res) => {
    if (db && sql) {
      try {
        await db.execute(sql`SELECT 1`);
        res.json({ status: "ok", db: "ok" });
      } catch {
        res.status(503).json({ status: "ok", db: "unreachable" });
      }
    } else {
      res.json({ status: "ok", db: "disabled" });
    }
  });

  // ── Bug Reports ───────────────────────────────────────────────────────────────
  const bugReportRateLimit = new Map<string, number>(); // IP -> last submit timestamp
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [ip, ts] of bugReportRateLimit) { if (ts < cutoff) bugReportRateLimit.delete(ip); }
  }, 60_000);

  app.post('/api/bug-report', async (req, res) => {
    const ip = req.ip || 'unknown';
    const last = bugReportRateLimit.get(ip) ?? 0;
    if (Date.now() - last < 60_000) {
      return res.status(429).json({ error: 'Please wait before submitting another report.' });
    }
    const { title, description, imageUrl } = req.body ?? {};
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ error: 'Title is required (min 3 chars).' });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description is required (min 10 chars).' });
    }
    // imageUrl must be a data URL (base64 image), max ~1.5 MB
    const cleanImageUrl = (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/'))
      ? (imageUrl.length <= 1_500_000 ? imageUrl : null)
      : null;
    bugReportRateLimit.set(ip, Date.now());
    if (!db || !schema) { return res.status(503).json({ error: 'Database not configured.' }); }
    try {
      await db.insert(schema.bugReport).values({
        id: randomUUID(),
        title: title.trim().slice(0, 120),
        description: description.trim().slice(0, 2000),
        imageUrl: cleanImageUrl,
        ip,
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 300),
      });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[bug-report insert failed]', e?.message ?? e);
      res.status(500).json({ error: 'Failed to save report.' });
    }
  });

  app.get('/api/admin/bug-reports', requireAdmin, async (_req, res) => {
    try {
      const reports = await db.select().from(schema.bugReport).orderBy(schema.bugReport.createdAt);
      res.json({ reports: reports.reverse() });
    } catch {
      res.status(500).json({ error: 'Failed to load bug reports.' });
    }
  });

  app.patch('/api/admin/bug-reports/:id', requireAdmin, async (req, res) => {
    const { status } = req.body ?? {};
    if (!['open', 'resolved', 'wontfix'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    try {
      await db.update(schema.bugReport).set({ status }).where(eq(schema.bugReport.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update report.' });
    }
  });

  // ─── Admin ─────────────────────────────────────────────────────────────────
  const ADMIN_TOKEN    = process.env.ADMIN_TOKEN    || '';
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
  // In-memory cache of the pushed board for fast /api/active-board reads.
  // Source of truth is the admin_board table (is_active flag).
  let activeAdminBoard: any = null;

  // Helper: shape a DB row into the legacy client shape (flat fields, ms timestamps).
  const rowToBoard = (r: any) => r ? ({
    id: r.id,
    name: r.name,
    boardSize: r.boardSize,
    tiles: r.tiles,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
  }) : null;

  // Load active board from DB on startup so it survives restarts.
  if (db && schema) {
    try {
      const rows = await db.select().from(schema.adminBoard).where(eq(schema.adminBoard.isActive, true)).limit(1);
      if (rows[0]) activeAdminBoard = rowToBoard(rows[0]);
    } catch (e: any) { log('admin_board startup load failed:', e?.message); }
  }

  // SEC: Timing-safe string comparison to prevent token oracle attacks
  function safeEqual(a: string, b: string): boolean {
    if (!a || !b) return false;
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    } catch { return false; }
  }

  function requireAdmin(req: any, res: any, next: any) {
    if (!ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
    const provided = typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : '';
    if (!safeEqual(provided, ADMIN_TOKEN)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  app.post('/api/admin/login', (req, res) => {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_TOKEN) {
      return res.status(503).json({ success: false, error: 'Admin access not configured on this server.' });
    }
    const ip = req.ip || 'unknown';
    if (isAdminLoginRateLimited(ip)) return res.status(429).json({ success: false, error: 'Too many login attempts.' });
    const { username, password } = req.body || {};
    if (safeEqual(String(username ?? ''), ADMIN_USERNAME) && safeEqual(String(password ?? ''), ADMIN_PASSWORD)) {
      res.json({ success: true, token: ADMIN_TOKEN });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  });

  const requireDB = (res: any) => {
    if (!db || !schema) { res.status(503).json({ error: 'Database not configured' }); return false; }
    return true;
  };

  app.get('/api/admin/boards', requireAdmin, async (_req, res) => {
    if (!requireDB(res)) return;
    try {
      const rows = await db.select().from(schema.adminBoard).orderBy(schema.adminBoard.createdAt);
      res.json({
        boards: rows.reverse().map(rowToBoard),
        activeBoard: activeAdminBoard,
      });
    } catch (e: any) {
      log('admin boards list failed:', e?.message);
      res.status(500).json({ error: 'Failed to load boards' });
    }
  });

  app.post('/api/admin/boards', requireAdmin, async (req, res) => {
    if (!requireDB(res)) return;
    // SEC-03: Whitelist known fields — never spread raw req.body into stored objects
    const { name, boardSize, tiles } = req.body ?? {};
    if (!name || typeof name !== 'string' || !Array.isArray(tiles)) {
      return res.status(400).json({ error: 'Invalid board payload' });
    }
    try {
      const [row] = await db.insert(schema.adminBoard).values({
        name: name.slice(0, 100),
        boardSize: Number(boardSize) || 40,
        tiles,
      }).returning();
      res.json({ success: true, board: rowToBoard(row) });
    } catch (e: any) {
      log('admin board save failed:', e?.message);
      res.status(500).json({ error: 'Failed to save board' });
    }
  });

  app.put('/api/admin/boards/:id', requireAdmin, async (req, res) => {
    if (!requireDB(res)) return;
    const { name, boardSize, tiles } = req.body ?? {};
    if (!name || !Array.isArray(tiles)) return res.status(400).json({ error: 'Invalid board payload' });
    try {
      const [row] = await db.update(schema.adminBoard)
        .set({ name: name.slice(0, 100), boardSize: Number(boardSize) || 40, tiles, updatedAt: new Date() })
        .where(eq(schema.adminBoard.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: 'Board not found' });
      if (activeAdminBoard?.id === row.id) activeAdminBoard = rowToBoard(row);
      res.json({ success: true, board: rowToBoard(row) });
    } catch (e: any) {
      log('admin board update failed:', e?.message);
      res.status(500).json({ error: 'Failed to update board' });
    }
  });

  app.delete('/api/admin/boards/:id', requireAdmin, async (req, res) => {
    if (!requireDB(res)) return;
    try {
      await db.delete(schema.adminBoard).where(eq(schema.adminBoard.id, req.params.id));
      if (activeAdminBoard?.id === req.params.id) activeAdminBoard = null;
      res.json({ success: true });
    } catch (e: any) {
      log('admin board delete failed:', e?.message);
      res.status(500).json({ error: 'Failed to delete board' });
    }
  });

  app.post('/api/admin/boards/:id/push', requireAdmin, async (req, res) => {
    if (!requireDB(res)) return;
    try {
      // Flip is_active=false on all others, then true on target (enforced by partial unique idx)
      await db.update(schema.adminBoard).set({ isActive: false }).where(eq(schema.adminBoard.isActive, true));
      const [row] = await db.update(schema.adminBoard)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(schema.adminBoard.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: 'Board not found' });
      activeAdminBoard = rowToBoard(row);
      io.emit('admin_board_pushed', { board: activeAdminBoard });
      log(`Admin pushed board "${row.name}" to all clients.`);
      res.json({ success: true });
    } catch (e: any) {
      log('admin board push failed:', e?.message);
      res.status(500).json({ error: 'Failed to push board' });
    }
  });

  // Public — clients fetch active board on page load / before starting game
  app.get('/api/active-board', (_req, res) => {
    res.json({ board: activeAdminBoard });
  });

  // SEC-02: Simple per-IP rate limiter factory — creates isolated limiters per endpoint
  function makeRateLimiter(maxRequests: number, windowMs: number) {
    const map = new Map<string, number[]>();
    return function isLimited(ip: string): boolean {
      const now = Date.now();
      const timestamps = map.get(ip) || [];
      const filtered = timestamps.filter(t => now - t < windowMs);
      if (filtered.length >= maxRequests) { map.set(ip, filtered); return true; }
      filtered.push(now);
      map.set(ip, filtered);
      return false;
    };
  }

  const isJoinRateLimited      = makeRateLimiter(10, 60_000); // 10 joins/min
  const isRoomCreateRateLimited = makeRateLimiter(5,  60_000); // 5 room creates/min
  const isAdminLoginRateLimited = makeRateLimiter(5,  60_000); // 5 login attempts/min
  const isWinCoinRateLimited    = makeRateLimiter(3,  60_000); // 3 coin awards/min

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
        // GL-6: Prefer a currently connected player; only fall back to any remaining slot if
        // everyone is offline. Skip emitting "you_are_host" when the heir is disconnected so
        // join_session can re-promote them on reconnect.
        const next = room.players.find((p: any) => !p.disconnected);
        const heir = next || room.players[0];
        if (heir) {
          room.host = heir.id;
          heir.isHost = true;
          room.hostName = heir.name || 'Player';
          // B4: Sync full game state to new host and inform them of their new role
          if (next && room.state) {
            io.to(heir.id).emit("sync_state", { state: room.state });
          }
          if (next) io.to(heir.id).emit("you_are_host");
        }
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

  // SEC-11: Whitelist alphanumerics + a few safe separators. Strips HTML metachars
  // (<, >, ", ', &), backticks, and anything that could land unescaped in rendered chat.
  // SEC-10: Reject prototype-pollution sentinels as names so they can never be used as object keys.
  const NAME_BLOCKLIST = new Set(['__proto__', 'prototype', 'constructor']);
  function sanitizeName(name: any): string {
    const cleaned = String(name || '')
      .replace(/[^A-Za-z0-9 _\-]/g, '')
      .trim()
      .slice(0, 20);
    if (NAME_BLOCKLIST.has(cleaned.toLowerCase())) return '';
    return cleaned;
  }

  // SEC-4: HTML-escape text before it is broadcast to any client that may render it.
  // React auto-escapes via text interpolation, but this is defence-in-depth for logs,
  // admin dashboards, and any consumer that forgets to escape.
  function escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    const ip = req.ip || 'unknown';
    if (isRoomCreateRateLimited(ip)) return res.status(429).json({ success: false, error: 'Too many requests. Please wait.' });
    const data = req.body;
    // SEC-08/09: Use CSPRNG for IDs instead of Math.random()
    const roomId = randomBytes(3).toString('hex').toUpperCase();
    const playerId = "p_" + randomUUID().replace(/-/g, '').slice(0, 16);
    const safeImg = (url: any) => (typeof url === 'string' && url.startsWith('https://') && url.length <= 500) ? url : undefined;
    const player = { id: playerId, originalId: playerId, name: sanitizeName(data.name), avatar: data.avatar, profileImage: safeImg(data.profileImage), isHost: true };
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
      const safeImg2 = (url: any) => (typeof url === 'string' && url.startsWith('https://') && url.length <= 500) ? url : undefined;
      const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, profileImage: safeImg2(data.profileImage), isHost: false };
      room.players.push(player);
      // We don't broadcast room_updated here because socket isn't connected yet.
      // We will broadcast when they actually connect their socket.
      res.json({ success: true, roomId: targetRoomId, playerId, players: room.players });
    } else {
      // Create a new room
      const roomId = randomBytes(3).toString('hex').toUpperCase();
      const playerId = "p_" + randomUUID().replace(/-/g, '').slice(0, 16);
      const safeImg3 = (url: any) => (typeof url === 'string' && url.startsWith('https://') && url.length <= 500) ? url : undefined;
      const player = { id: playerId, originalId: playerId, name: sanitizeName(data.name), avatar: data.avatar, profileImage: safeImg3(data.profileImage), isHost: true };
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
        const safeImg4 = (url: any) => (typeof url === 'string' && url.startsWith('https://') && url.length <= 500) ? url : undefined;
        const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, profileImage: safeImg4(data.profileImage), isHost: true };
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
        const safeImg5 = (url: any) => (typeof url === 'string' && url.startsWith('https://') && url.length <= 500) ? url : undefined;
        const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, profileImage: safeImg5(data.profileImage), isHost: false, isSpectator: true };
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
    const safeImg6 = (url: any) => (typeof url === 'string' && url.startsWith('https://') && url.length <= 500) ? url : undefined;
    const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, profileImage: safeImg6(data.profileImage), isHost: false };
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
              // SEC: Accept numeric palette index (0..31) OR a short alphanumeric/hex token
              const isValidNum = typeof data.avatar === 'number' && Number.isInteger(data.avatar) && data.avatar >= 0 && data.avatar < 32;
              const isValidStr = typeof data.avatar === 'string' && /^[#a-zA-Z0-9_-]{1,30}$/.test(data.avatar);
              if (!isValidNum && !isValidStr) {
                if (callback) callback({ success: false, error: 'Invalid avatar' });
                return;
              }
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
          // SEC: Cap start_game payload — same 512KB ceiling used by sync_state.
          try {
            const raw = JSON.stringify(data?.initialState ?? null);
            if (!raw || raw.length > 512 * 1024) return;
          } catch { return; }
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
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.host !== socket.id || room.state) return;
      // SEC: Validate playerId shape before searching the room (prevents prototype/regex abuse).
      const pid = data?.playerId;
      if (typeof pid !== 'string' || pid.length > 64 || !/^[A-Za-z0-9_-]+$/.test(pid)) return;
      if (pid === socket.id) return; // host can't kick themselves
      const playerIndex = room.players.findIndex(p => p.id === pid);
      if (playerIndex === -1) return;
      const kickedPlayer = room.players[playerIndex];
      room.players.splice(playerIndex, 1);
      io.sockets.sockets.get(kickedPlayer.id)?.leave(roomId);
      io.to(kickedPlayer.id).emit("kicked");
      io.to(roomId).emit("room_updated", { players: room.players });
      scheduleRoomsListBroadcast();
    });

    socket.on("update_settings", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.host !== socket.id || room.state) return;
      const s = data?.settings;
      if (!s || typeof s !== 'object') return;
      // SEC: Whitelist + bound-check every field. Build a clean settings object for broadcast
      // so clients can't smuggle extra keys.
      const clean: { isPrivate?: boolean; maxPlayers?: number } = {};
      if (typeof s.isPrivate === 'boolean') {
        room.isPrivate = s.isPrivate;
        clean.isPrivate = s.isPrivate;
      }
      if (Number.isInteger(s.maxPlayers) && s.maxPlayers >= 2 && s.maxPlayers <= 8) {
        // Can't shrink below current player count
        if (s.maxPlayers >= room.players.length) {
          room.maxPlayers = s.maxPlayers;
          clean.maxPlayers = s.maxPlayers;
        }
      }
      if (Object.keys(clean).length === 0) return;
      socket.to(roomId).emit("settings_updated", clean);
      scheduleRoomsListBroadcast();
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
          // B9: Only promote a currently connected player; if all are disconnected, assign the
          // first player as nominal host but skip the emit (join_session will auto-promote on reconnect)
          const next = room.players.find((p: any) => !p.disconnected);
          const heir = next || room.players[0];
          if (heir) {
            room.host = heir.id;
            heir.isHost = true;
            room.hostName = heir.name || 'Player';
            if (next) io.to(next.id).emit("you_are_host");
          }
        }
        io.to(roomId).emit("room_updated", { players: room.players });
      }
      scheduleRoomsListBroadcast();
    });

    // SEC: Per-socket chat history for flood + duplicate-spam detection (beyond the 10/sec generic limiter).
    const chatHistory: { t: number; msg: string }[] = [];
    const CHAT_WINDOW_MS = 10_000;
    const CHAT_MAX_PER_WINDOW = 6;
    const CHAT_MAX_UNBROKEN_RUN = 30; // no single token longer than this (anti-wall-of-text)

    socket.on("send_chat", (data) => {
      if (isRateLimited('chat')) return;
      // NET-07: Reject oversized or malformed chat messages
      if (typeof data?.text !== 'string' || data.text.length === 0 || data.text.length > 500) return;
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (!roomId) return;
      // BUG-19: Look up sender name server-side to prevent client impersonation
      const room = rooms.get(roomId);
      if (!room) return;
      const chatPlayer = room.players.find((p: any) => p.id === socket.id);
      if (!chatPlayer) return;

      // SEC: Strip control chars + zero-width + bidi override + non-character ranges that can
      // be used to spoof names ("𝗮𝗱𝗺𝗶𝗻"-style homoglyphs are left alone; rendering spoofs are not).
      const cleaned = data.text
        .replace(/[\u0000-\u001F\u007F]/g, '')      // C0/DEL control chars
        .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '') // zero-width + bidi overrides
        .trim();
      if (!cleaned) return;

      // SEC: Break unbroken runs (letters/digits/punct with no whitespace) that exceed the cap
      // so they can't escape CSS word-break and overflow the chat panel.
      const broken = cleaned.replace(
        new RegExp(`(\\S{${CHAT_MAX_UNBROKEN_RUN}})(?=\\S)`, 'g'),
        '$1 '
      );

      // SEC: Sliding-window flood guard — stricter than the 10/sec generic limiter.
      const now = Date.now();
      while (chatHistory.length && now - chatHistory[0].t > CHAT_WINDOW_MS) chatHistory.shift();
      if (chatHistory.length >= CHAT_MAX_PER_WINDOW) return;

      // SEC: Reject 3+ identical messages in a row (copy-paste spam).
      const last = chatHistory[chatHistory.length - 1];
      const prior = chatHistory[chatHistory.length - 2];
      if (last?.msg === broken && prior?.msg === broken) return;

      chatHistory.push({ t: now, msg: broken });

      // SEC-4: HTML-escape before broadcast.
      const safeText = escapeHtml(broken);
      if (!safeText) return;
      // SEC: Use server clock, not client-supplied time, so clients can't backdate or spoof ordering.
      io.to(roomId).emit("chat_message", { sender: chatPlayer.name, text: safeText, time: now });
    });

    // SEC-05 / CQ-8: Allowlist lives in services/actionPolicy.ts — shared with App.tsx host gate.

    // SEC-9: Reject action payloads that are abusively large or deeply nested. Prevents a
    // malicious client from tying up the host with pathological JSON structures.
    const MAX_PAYLOAD_BYTES = 16 * 1024;
    const MAX_PAYLOAD_DEPTH = 5;
    function payloadDepth(v: any, depth = 0): number {
      if (depth > MAX_PAYLOAD_DEPTH) return depth;
      if (v === null || typeof v !== 'object') return depth;
      let max = depth;
      for (const key of Object.keys(v)) {
        // SEC-10: Prototype-pollution sentinel guard on any key we might later iterate.
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') return MAX_PAYLOAD_DEPTH + 1;
        const next = payloadDepth(v[key], depth + 1);
        if (next > max) max = next;
        if (max > MAX_PAYLOAD_DEPTH) return max;
      }
      return max;
    }

    socket.on("game_action", (data) => {
      if (isRateLimited('action')) {
        socket.emit("action_error", { error: "Too many actions — slow down" });
        return;
      }
      // SEC-9: Size + depth guard before we spend more CPU on this action.
      try {
        const serialised = JSON.stringify(data ?? {});
        if (serialised.length > MAX_PAYLOAD_BYTES) {
          socket.emit("action_error", { error: "Action payload too large" });
          return;
        }
        if (payloadDepth(data) > MAX_PAYLOAD_DEPTH) {
          socket.emit("action_error", { error: "Action payload too deeply nested" });
          return;
        }
      } catch {
        socket.emit("action_error", { error: "Invalid action payload" });
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
          // Own-turn-only guard: actions that mutate the current player's own state
          // (rolling, buying, building, selling, mortgaging, ending turn, etc.) may
          // only be submitted by whoever is currently on the clock. Off-turn actions
          // like trades, auction bids, and kick votes are unrestricted here.
          const playerRow = room.players.find((p: any) => p.id === socket.id);
          const socketKey = playerRow?.originalId || socket.id;
          const senderGamePlayerId = room.socketToGamePlayerId?.[socketKey];
          if (OWN_TURN_ONLY_ACTIONS.has(data.type) && room.state?.players) {
            const currentPlayerId = room.state.players?.[room.state.currentPlayerIndex]?.id;
            if (senderGamePlayerId === undefined || senderGamePlayerId !== currentPlayerId) {
              socket.emit("action_error", { error: "Not your turn" });
              return;
            }
          }
          // Identity guard: off-turn actions that name a player in their payload
          // (PROPOSE_TRADE.proposerId, PLACE_BID.bidderId, DECLARE_BANKRUPT.playerId,
          // VOTE_KICK.voterId, etc.) must match the sender. Prevents one client from
          // submitting actions on behalf of another. Host actions (sender is the host
          // socket) bypass this since the host legitimately submits bot actions.
          const isHostSocket = room.host === socket.id;
          if (!isHostSocket && data?.payload && typeof data.payload === 'object' && senderGamePlayerId !== undefined) {
            const identityFields = ['proposerId', 'bidderId', 'voterId', 'playerId'];
            for (const field of identityFields) {
              const claimed = (data.payload as any)[field];
              if (claimed !== undefined && claimed !== null && String(claimed) !== String(senderGamePlayerId)) {
                socket.emit("action_error", { error: `Cannot submit '${data.type}' on behalf of another player` });
                return;
              }
            }
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
          // Detect a freshly-accepted trade (lastTradeLog.ts changed since last sync) and persist
          const prevTradeTs = room.state?.lastTradeLog?.ts;
          const newTradeLog = data.state?.lastTradeLog;
          if (
            db && schema?.tradeHistory &&
            newTradeLog?.result === 'accepted' &&
            typeof newTradeLog.ts === 'number' &&
            newTradeLog.ts !== prevTradeTs
          ) {
            // Best-effort fire-and-forget — never block the game loop
            db.insert(schema.tradeHistory).values({
              roomId,
              fromName: String(newTradeLog.proposerName ?? ''),
              toName: String(newTradeLog.targetName ?? ''),
              offered: {
                cash: Number(newTradeLog.offerCash ?? 0),
                properties: Array.isArray(newTradeLog.offerPropertyNames) ? newTradeLog.offerPropertyNames : [],
              },
              requested: {
                cash: Number(newTradeLog.requestCash ?? 0),
                property: String(newTradeLog.targetPropertyName ?? ''),
              },
              accepted: true,
            }).catch((err: any) => {
              if (process.env.NODE_ENV !== 'production') log('tradeHistory insert failed:', err?.message);
            });
          }
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
                // B9: Only promote a connected player; fall back to first if all disconnected
                const next = room.players.find((p: any) => !p.disconnected);
                const heir = next || room.players[0];
                if (heir) {
                  room.host = heir.id;
                  heir.isHost = true;
                  room.hostName = heir.name || 'Player';
                  if (next) io.to(next.id).emit("you_are_host");
                }
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

  // Helper: get authed user from request via Better Auth session cookie.
  async function getSessionUser(req: any) {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      return session?.user ?? null;
    } catch {
      return null;
    }
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
      const [userData] = await db
        .select({ coins: schema.profiles.coins, equippedAvatarItemId: schema.profiles.equippedAvatarItemId })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, req.params.userId));
      res.json({
        itemIds: purchases.map(p => p.itemId),
        coins: userData?.coins ?? 0,
        equippedAvatarItemId: userData?.equippedAvatarItemId ?? null,
      });
    } catch {
      res.status(500).json({ error: 'Failed to load inventory' });
    }
  });

  app.post('/api/store/equip', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    const { itemId } = req.body ?? {};
    try {
      if (itemId === null || itemId === undefined) {
        // Unequip — clear equipped avatar and image
        await db.update(schema.profiles)
          .set({ equippedAvatarItemId: null, image: null })
          .where(eq(schema.profiles.id, sessionUser.id));
        return res.json({ success: true, assetUrl: null });
      }
      // Verify ownership
      const [owned] = await db.select().from(schema.purchase)
        .where(and(eq(schema.purchase.userId, sessionUser.id), eq(schema.purchase.itemId, itemId)));
      if (!owned) return res.status(403).json({ error: 'Item not owned' });
      // Verify it is a profile_pic item
      const [item] = await db.select().from(schema.storeItem)
        .where(and(eq(schema.storeItem.id, itemId), eq(schema.storeItem.active, true)));
      if (!item || item.type !== 'profile_pic') return res.status(400).json({ error: 'Not a profile pic item' });
      // Equip: set equipped pointer and update profile image to asset URL
      await db.update(schema.profiles)
        .set({ equippedAvatarItemId: itemId, image: item.assetUrl ?? null })
        .where(eq(schema.profiles.id, sessionUser.id));
      res.json({ success: true, assetUrl: item.assetUrl });
    } catch {
      res.status(500).json({ error: 'Failed to equip item' });
    }
  });

  app.post('/api/store/purchase', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });

    const { itemId } = req.body ?? {};
    if (!itemId || typeof itemId !== 'string') return res.status(400).json({ error: 'itemId required' });

    try {
      // Load item outside transaction (read-only, no race risk)
      const [item] = await db.select().from(schema.storeItem).where(and(eq(schema.storeItem.id, itemId), eq(schema.storeItem.active, true)));
      if (!item) return res.status(404).json({ error: 'Item not found' });

      // SEC-01/02: Atomic transaction — prevents double-spend race and duplicate purchases
      let newCoins: number;
      try {
        newCoins = await db.transaction(async (tx: any) => {
          // Re-check ownership inside transaction
          const [existing] = await tx.select({ id: schema.purchase.id })
            .from(schema.purchase)
            .where(and(eq(schema.purchase.userId, sessionUser.id), eq(schema.purchase.itemId, itemId)));
          if (existing) throw Object.assign(new Error('Already owned'), { code: 'ALREADY_OWNED' });

          // Atomic deduction: only succeeds if coins >= price at this exact moment
          const [updated] = await tx.update(schema.profiles)
            .set({ coins: sql`coins - ${item.priceCoins}` })
            .where(and(eq(schema.profiles.id, sessionUser.id), sql`coins >= ${item.priceCoins}`))
            .returning({ coins: schema.profiles.coins });

          if (!updated) throw Object.assign(new Error('Insufficient coins'), { code: 'INSUFFICIENT_COINS' });

          await tx.insert(schema.purchase).values({ id: randomUUID(), userId: sessionUser.id, itemId, purchasedAt: new Date() });
          return updated.coins;
        });
      } catch (txErr: any) {
        if (txErr?.code === 'ALREADY_OWNED') return res.status(400).json({ error: 'Already owned' });
        if (txErr?.code === 'INSUFFICIENT_COINS') return res.status(400).json({ error: 'Insufficient coins' });
        throw txErr;
      }

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
    const { role, banned, banReason, coins, name, addCoins } = req.body ?? {};
    const updates: Record<string, any> = {};
    if (role !== undefined) {
      const allowedRoles = new Set(['user', 'admin', 'moderator']);
      if (!allowedRoles.has(String(role))) return res.status(400).json({ error: 'Invalid role' });
      updates.role = role;
    }
    if (banned !== undefined) updates.banned = Boolean(banned);
    if (banReason !== undefined) updates.banReason = banReason === null ? null : String(banReason).slice(0, 500);
    if (coins !== undefined) {
      const parsedCoins = Number(coins);
      if (!isFinite(parsedCoins)) return res.status(400).json({ error: 'Invalid coins value' });
      updates.coins = Math.max(0, Math.floor(parsedCoins));
    }
    if (name !== undefined) updates.name = String(name).trim().slice(0, 40);
    try {
      if (addCoins !== undefined && Number(addCoins) !== 0) {
        const delta = Number(addCoins);
        if (!isFinite(delta)) return res.status(400).json({ error: 'Invalid addCoins value' });
        const rows = await db.select({ coins: schema.profiles.coins }).from(schema.profiles).where(eq(schema.profiles.id, req.params.id));
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        updates.coins = Math.max(0, Math.floor((rows[0].coins || 0) + delta));
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
      await db.update(schema.profiles).set(updates).where(eq(schema.profiles.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // ─── Admin: DB health probe ───────────────────────────────────────────────────
  // Exercises connect / read / write (insert+delete) / transaction rollback
  // and reports row counts for every known table so admins can verify the
  // Dokploy Postgres service is wired correctly.
  app.post('/api/admin/db-test', requireAdmin, async (_req, res) => {
    const checks: Array<{ name: string; ok: boolean; ms: number; detail?: string }> = [];
    const time = async (name: string, fn: () => Promise<string | void>) => {
      const t0 = Date.now();
      try {
        const detail = (await fn()) || undefined;
        checks.push({ name, ok: true, ms: Date.now() - t0, detail });
      } catch (err: any) {
        checks.push({ name, ok: false, ms: Date.now() - t0, detail: err?.message ?? String(err) });
      }
    };

    let dbVersion = '';
    await time('connect', async () => {
      const r = await db.execute(sql`select version() as v`);
      dbVersion = String(r?.rows?.[0]?.v ?? '').slice(0, 80);
      return dbVersion;
    });

    await time('read: user table', async () => {
      const rows = await db.select().from(schema.profiles).limit(1);
      return `${rows.length} row(s) sampled`;
    });

    await time('write: insert+delete bug_report', async () => {
      const probeId = `probe_${randomUUID()}`;
      await db.insert(schema.bugReport).values({
        id: probeId,
        title: '__db_probe__',
        description: 'db-test probe row; safe to delete',
        status: 'resolved',
        consentGiven: false,
      });
      const [row] = await db.select().from(schema.bugReport).where(eq(schema.bugReport.id, probeId));
      if (!row) throw new Error('insert succeeded but row not readable');
      await db.delete(schema.bugReport).where(eq(schema.bugReport.id, probeId));
      const [gone] = await db.select().from(schema.bugReport).where(eq(schema.bugReport.id, probeId));
      if (gone) throw new Error('delete did not remove probe row');
      return 'roundtrip OK';
    });

    await time('transaction: rollback', async () => {
      try {
        await db.transaction(async (tx: any) => {
          await tx.insert(schema.bugReport).values({
            id: `probe_tx_${randomUUID()}`,
            title: '__db_probe_tx__',
            description: 'should roll back',
            status: 'open',
            consentGiven: false,
          });
          throw new Error('__rollback__');
        });
      } catch (e: any) {
        if (e?.message !== '__rollback__') throw e;
      }
      const rows = await db.select().from(schema.bugReport).where(eq(schema.bugReport.title, '__db_probe_tx__'));
      if (rows.length) throw new Error('rollback did not discard row');
      return 'atomicity verified';
    });

    const tableCounts: Record<string, number | string> = {};
    const tables: Array<[string, any]> = [
      ['user', schema.user],
      ['session', schema.session],
      ['account', schema.account],
      ['verification', schema.verification],
      ['store_item', schema.storeItem],
      ['purchase', schema.purchase],
      ['user_stats', schema.profilesStats],
      ['bug_report', schema.bugReport],
      ['friendships', schema.friendships],
      ['game_history', schema.gameHistory],
      ['trade_history', schema.tradeHistory],
      ['audit_log', schema.auditLog],
      ['admin_board', schema.adminBoard],
      ['achievements', schema.achievements],
      ['user_achievements', schema.userAchievements],
    ];
    await time('row counts (all tables)', async () => {
      for (const [name, tbl] of tables) {
        try {
          const r = await db.execute(sql`select count(*)::int as n from ${tbl}`);
          tableCounts[name] = r?.rows?.[0]?.n ?? 0;
        } catch (e: any) {
          tableCounts[name] = `ERROR: ${e?.message ?? 'failed'}`;
        }
      }
      return `${tables.length} tables probed`;
    });

    const ok = checks.every(c => c.ok);
    res.status(ok ? 200 : 500).json({
      ok,
      dbUrlHost: (() => { try { return new URL(process.env.DATABASE_URL!).host; } catch { return 'unknown'; } })(),
      dbVersion,
      checks,
      tableCounts,
    });
  });

  app.get('/api/admin/analytics', requireAdmin, async (_req, res) => {
    try {
      const users = await db.select().from(schema.profiles);
      const stats = await db.select().from(schema.profilesStats);
      const totalUsers = users.length;
      const totalGamesPlayed = stats.reduce((s: number, r: any) => s + (r.gamesPlayed || 0), 0);
      const totalWins = stats.reduce((s: number, r: any) => s + (r.gamesWon || 0), 0);
      const totalCoins = users.reduce((s: number, u: any) => s + (u.coins || 0), 0);
      const avgCoins = totalUsers > 0 ? Math.round(totalCoins / totalUsers) : 0;
      const topEarners = [...users]
        .sort((a: any, b: any) => (b.coins || 0) - (a.coins || 0))
        .slice(0, 5)
        .map((u: any) => ({ name: u.name, coins: u.coins || 0 }));
      const bannedCount = users.filter((u: any) => u.banned).length;
      const toTime = (d: any) => { const t = d ? new Date(d).getTime() : 0; return isFinite(t) ? t : 0; };
      const recentUsers = [...users]
        .sort((a: any, b: any) => toTime(b.createdAt) - toTime(a.createdAt))
        .slice(0, 5)
        .map((u: any) => ({ name: u.name, email: u.email, createdAt: u.createdAt }));
      res.json({ totalUsers, totalGamesPlayed, totalWins, totalCoins, avgCoins, topEarners, bannedCount, recentUsers });
    } catch {
      res.status(500).json({ error: 'Failed to load analytics' });
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

  const ALLOWED_ITEM_TYPES = new Set(['avatar', 'board_skin', 'token', 'profile_pic', 'misc']);

  app.post('/api/admin/store/items', requireAdmin, async (req, res) => {
    const { name, description, type, priceCoins, assetUrl } = req.body ?? {};
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });
    if (!ALLOWED_ITEM_TYPES.has(String(type))) return res.status(400).json({ error: 'Invalid item type' });
    const price = Number(priceCoins ?? 100);
    if (!isFinite(price) || price < 0) return res.status(400).json({ error: 'Invalid priceCoins' });
    try {
      const item = {
        id: randomUUID(),
        name: String(name).slice(0, 80),
        description: String(description ?? '').slice(0, 500),
        type: String(type),
        priceCoins: Math.floor(price),
        assetUrl: assetUrl ? String(assetUrl).slice(0, 500) : null,
        active: true,
        createdAt: new Date(),
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
    if (name !== undefined) updates.name = String(name).slice(0, 80);
    if (description !== undefined) updates.description = String(description).slice(0, 500);
    if (type !== undefined) {
      if (!ALLOWED_ITEM_TYPES.has(String(type))) return res.status(400).json({ error: 'Invalid item type' });
      updates.type = String(type);
    }
    if (priceCoins !== undefined) {
      const price = Number(priceCoins);
      if (!isFinite(price) || price < 0) return res.status(400).json({ error: 'Invalid priceCoins' });
      updates.priceCoins = Math.floor(price);
    }
    if (assetUrl !== undefined) updates.assetUrl = assetUrl === null ? null : String(assetUrl).slice(0, 500);
    if (active !== undefined) updates.active = Boolean(active);
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
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

  // ─── Ads ──────────────────────────────────────────────────────────────────
  const AD_PLACEMENTS = new Set([
    'lobby_top', 'lobby_bottom', 'lobby_sidebar',
    'game_sidebar', 'game_footer',
    'global_header', 'global_footer',
    'store_top', 'profile_top',
  ]);

  // Public — only enabled + within window. Grouped by placement for cheap lookup.
  app.get('/api/ads', async (_req, res) => {
    try {
      const rows = await db.select().from(schema.ad);
      const now = Date.now();
      const visible = rows.filter(r => {
        if (!r.enabled) return false;
        if (r.startsAt && new Date(r.startsAt).getTime() > now) return false;
        if (r.endsAt && new Date(r.endsAt).getTime() < now) return false;
        return true;
      });
      const grouped: Record<string, any[]> = {};
      for (const r of visible) {
        (grouped[r.placement] ||= []).push({
          id: r.id, name: r.name, placement: r.placement,
          imageUrl: r.imageUrl, linkUrl: r.linkUrl,
          htmlSnippet: r.htmlSnippet, altText: r.altText,
          weight: r.weight,
        });
      }
      res.json({ ads: grouped });
    } catch {
      res.status(500).json({ ads: {} });
    }
  });

  // Track impression / click — best-effort, errors swallowed.
  app.post('/api/ads/:id/track', async (req, res) => {
    const kind = req.body?.kind === 'click' ? 'clicks' : 'impressions';
    try {
      const col = kind === 'clicks' ? schema.ad.clicks : schema.ad.impressions;
      await db.update(schema.ad).set({ [kind]: sql`${col} + 1` } as any).where(eq(schema.ad.id, req.params.id));
    } catch { /* best-effort */ }
    res.json({ ok: true });
  });

  app.get('/api/admin/ads', requireAdmin, async (_req, res) => {
    try {
      const ads = await db.select().from(schema.ad);
      res.json({ ads, placements: Array.from(AD_PLACEMENTS) });
    } catch {
      res.status(500).json({ error: 'Failed to load ads' });
    }
  });

  function sanitizeAdBody(body: any) {
    const out: Record<string, any> = {};
    if (body.name !== undefined) out.name = String(body.name).slice(0, 120);
    if (body.placement !== undefined) {
      if (!AD_PLACEMENTS.has(String(body.placement))) return { error: 'Invalid placement' };
      out.placement = String(body.placement);
    }
    if (body.imageUrl !== undefined) out.imageUrl = body.imageUrl ? String(body.imageUrl).slice(0, 1000) : null;
    if (body.linkUrl !== undefined) out.linkUrl = body.linkUrl ? String(body.linkUrl).slice(0, 1000) : null;
    if (body.htmlSnippet !== undefined) out.htmlSnippet = body.htmlSnippet ? String(body.htmlSnippet).slice(0, 4000) : null;
    if (body.altText !== undefined) out.altText = body.altText ? String(body.altText).slice(0, 200) : null;
    if (body.weight !== undefined) {
      const w = Number(body.weight);
      if (!isFinite(w) || w < 0) return { error: 'Invalid weight' };
      out.weight = Math.floor(w);
    }
    if (body.enabled !== undefined) out.enabled = Boolean(body.enabled);
    if (body.startsAt !== undefined) out.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.endsAt !== undefined) out.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    return { updates: out };
  }

  app.post('/api/admin/ads', requireAdmin, async (req, res) => {
    const { name, placement } = req.body ?? {};
    if (!name || !placement) return res.status(400).json({ error: 'name and placement required' });
    const result = sanitizeAdBody(req.body ?? {});
    if (result.error) return res.status(400).json({ error: result.error });
    try {
      const ad = {
        id: randomUUID(),
        ...result.updates,
        weight: result.updates.weight ?? 1,
        enabled: result.updates.enabled ?? true,
        impressions: 0,
        clicks: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(schema.ad).values(ad as any);
      res.json({ success: true, ad });
    } catch {
      res.status(500).json({ error: 'Failed to create ad' });
    }
  });

  app.patch('/api/admin/ads/:id', requireAdmin, async (req, res) => {
    const result = sanitizeAdBody(req.body ?? {});
    if (result.error) return res.status(400).json({ error: result.error });
    if (Object.keys(result.updates).length === 0) return res.status(400).json({ error: 'No valid fields' });
    result.updates.updatedAt = new Date();
    try {
      await db.update(schema.ad).set(result.updates).where(eq(schema.ad.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update ad' });
    }
  });

  app.delete('/api/admin/ads/:id', requireAdmin, async (req, res) => {
    try {
      await db.delete(schema.ad).where(eq(schema.ad.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete ad' });
    }
  });

  // ─── Profile ──────────────────────────────────────────────────────────────

  app.get('/api/profile/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      // SEC-7: Email is PII — only return it when the requester IS the profile owner.
      // Anyone else sees the public-facing subset (name, image, stats, friend count).
      const viewer = await getSessionUser(req).catch(() => null);
      const isSelf = !!(viewer && viewer.id === userId);
      const users = await db.select().from(schema.profiles).where(eq(schema.profiles.id, userId));
      if (!users.length) return res.status(404).json({ error: 'User not found' });
      const u = users[0];
      // Better Auth stores the OAuth avatar on user.image directly at sign-in,
      // so no separate backfill step is needed.
      const statsList = await db.select().from(schema.profilesStats).where(eq(schema.profilesStats.userId, userId));
      const stats = statsList[0] ?? { gamesPlayed: 0, gamesWon: 0, totalEarnings: 0, propertiesBought: 0 };
      const friendRows = schema.friendships
        ? await db.select().from(schema.friendships).where(
            and(
              eq(schema.friendships.status, 'accepted'),
              or(eq(schema.friendships.requesterId, userId), eq(schema.friendships.addresseeId, userId))
            )
          )
        : [];
      res.json({
        id: u.id,
        name: u.name,
        // SEC-7: gate email on self-request
        email: isSelf ? u.email : undefined,
        image: u.image,
        coins: u.coins,
        createdAt: u.createdAt,
        stats,
        friendCount: friendRows.length,
      });
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

  app.post('/api/profile/win-coin', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    if (isWinCoinRateLimited(sessionUser.id)) return res.status(429).json({ error: 'Too many requests.' });
    try {
      const rows = await db.select({ coins: schema.profiles.coins }).from(schema.profiles).where(eq(schema.profiles.id, sessionUser.id));
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const newCoins = (rows[0].coins || 0) + 1;
      await db.update(schema.profiles).set({ coins: newCoins }).where(eq(schema.profiles.id, sessionUser.id));
      res.json({ success: true, coins: newCoins });
    } catch {
      res.status(500).json({ error: 'Failed to award coin' });
    }
  });

  // ── Profile edit ─────────────────────────────────────────────────────────────
  app.patch('/api/profile', async (req, res) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    const { name, image } = req.body ?? {};
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name && typeof name === 'string') updates.name = name.trim().slice(0, 40);
    if (image && typeof image === 'string') {
      // SEC: Accept HTTPS URLs (<=500 chars) or our SVG-emoji data URIs (<=2000 chars)
      const trimmedImage = image.trim();
      const isHttps = trimmedImage.startsWith('https://') && trimmedImage.length <= 500;
      const isSvgData = trimmedImage.startsWith('data:image/svg+xml,') && trimmedImage.length <= 2000;
      if (isHttps || isSvgData) {
        updates.image = trimmedImage;
      }
    }
    try {
      await db.update(schema.profiles).set(updates).where(eq(schema.profiles.id, sessionUser.id));
      // Better Auth reads name/image from the user row on every session fetch,
      // so the next /get-session call will reflect the update automatically.
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
    // Gzip/brotli compress all responses
    app.use(compression());
    // Hashed assets (JS/CSS chunks) are immutable — cache for 1 year
    app.use(express.static(distPath, {
      setHeaders(res, filePath) {
        if (/\.(js|css)$/.test(filePath) && /[.-][a-f0-9]{8,}\.(js|css)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }));
    // SPA fallback: serve index.html for all non-API routes
    app.use((req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.default.resolve(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    log(`Server running on http://localhost:${PORT}`);
  });
}

// SEC-05: Global crash guards — prevent a single unhandled async error from killing the process
process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED_REJECTION]', reason?.stack || reason);
});
process.on('uncaughtException', (err: Error) => {
  console.error('[UNCAUGHT_EXCEPTION]', err.stack || err.message);
  // Give the process a moment to flush logs, then exit so the process manager restarts cleanly
  setTimeout(() => process.exit(1), 500);
});

startServer();
