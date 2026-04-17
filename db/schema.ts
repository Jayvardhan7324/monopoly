import { pgTable, text, boolean, timestamp, integer, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";

// ── Profiles (mirrors Supabase auth.users — FK to auth.users enforced by SQL migration) ──
export const profiles = pgTable("profiles", {
  id:          text("id").primaryKey(),            // = auth.users.id (UUID as text)
  name:        text("name").notNull().default(""),
  email:       text("email").notNull().default(""),
  image:       text("image"),
  role:        text("role").default("user"),
  banned:      boolean("banned").default(false),
  banReason:   text("ban_reason"),
  banExpires:  timestamp("ban_expires"),
  coins:                integer("coins").notNull().default(500),
  equippedAvatarItemId: text("equipped_avatar_item_id"),  // FK set via SQL migration
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

// ── Store tables ──────────────────────────────────────────────────────────────
export const storeItem = pgTable("store_item", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  type:        text("type").notNull(), // 'avatar' | 'board_skin' | 'token' | 'profile_pic' | 'misc'
  priceCoins:  integer("price_coins").notNull().default(100),
  assetUrl:    text("asset_url"),
  active:      boolean("active").notNull().default(true),
  createdAt:   timestamp("created_at").notNull(),
});

export const purchase = pgTable("purchase", {
  id:          text("id").primaryKey(),
  userId:      text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  itemId:      text("item_id").notNull().references(() => storeItem.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at").notNull(),
}, (t) => [
  index("purchase_user_id_idx").on(t.userId),
  uniqueIndex("purchase_user_item_unique").on(t.userId, t.itemId),
]);

// ── Player stats ──────────────────────────────────────────────────────────────
export const profilesStats = pgTable("user_stats", {
  userId:              text("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  gamesPlayed:         integer("games_played").notNull().default(0),
  gamesWon:            integer("games_won").notNull().default(0),
  gamesLost:           integer("games_lost").notNull().default(0),
  totalEarnings:       integer("total_earnings").notNull().default(0),
  propertiesBought:    integer("properties_bought").notNull().default(0),
  peakPropertiesOwned: integer("peak_properties_owned").notNull().default(0),
  bankruptcies:        integer("bankruptcies").notNull().default(0),
  totalTurns:          integer("total_turns").notNull().default(0),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});

// ── Bug Reports ───────────────────────────────────────────────────────────────
export const bugReport = pgTable("bug_report", {
  id:            text("id").primaryKey().$defaultFn(() => randomUUID()),
  title:         text("title").notNull(),
  description:   text("description").notNull(),
  ip:            text("ip"),
  userAgent:     text("user_agent"),
  imageUrl:      text("image_url"),
  status:        text("status").notNull().default("open"), // 'open' | 'resolved' | 'wontfix'
  // SEC-13: Track whether user consented to IP/UA storage.
  consentGiven:  boolean("consent_given").notNull().default(false),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("bug_report_status_idx").on(t.status),
  index("bug_report_created_at_idx").on(t.createdAt),
]);

// ── Friendships ───────────────────────────────────────────────────────────────
export const friendships = pgTable("friendships", {
  id:          text("id").primaryKey().$defaultFn(() => randomUUID()),
  requesterId: text("requester_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  addresseeId: text("addressee_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status:      text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined'
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("friendships_requester_id_idx").on(t.requesterId),
  index("friendships_addressee_id_idx").on(t.addresseeId),
  index("friendships_status_idx").on(t.status),
  uniqueIndex("friendships_pair_unique").on(t.requesterId, t.addresseeId),
]);

// ── Game History (DB-1) ───────────────────────────────────────────────────────
// Powers leaderboards, per-player stats screen, and replay system.
export const gameHistory = pgTable("game_history", {
  id:              text("id").primaryKey().$defaultFn(() => randomUUID()),
  roomId:          text("room_id").notNull(),
  hostUserId:      text("host_user_id").references(() => profiles.id, { onDelete: "set null" }),
  winnerUserId:    text("winner_user_id").references(() => profiles.id, { onDelete: "set null" }),
  players:         jsonb("players").notNull(),         // [{ userId, name, isBot, finalNetWorth }]
  finalNetWorth:   jsonb("final_net_worth"),           // { playerId: number }
  startedAt:       timestamp("started_at").notNull(),
  endedAt:         timestamp("ended_at").notNull().defaultNow(),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  turnsPlayed:     integer("turns_played").notNull().default(0),
}, (t) => [
  index("game_history_winner_idx").on(t.winnerUserId),
  index("game_history_host_idx").on(t.hostUserId),
  index("game_history_ended_idx").on(t.endedAt),
]);

// ── Trade History (DB-2) ──────────────────────────────────────────────────────
// Powers trade log sidebar (F-H) and analytics.
export const tradeHistory = pgTable("trade_history", {
  id:          text("id").primaryKey().$defaultFn(() => randomUUID()),
  gameId:      text("game_id").references(() => gameHistory.id, { onDelete: "cascade" }),
  roomId:      text("room_id").notNull(),
  fromUserId:  text("from_user_id").references(() => profiles.id, { onDelete: "set null" }),
  toUserId:    text("to_user_id").references(() => profiles.id, { onDelete: "set null" }),
  fromName:    text("from_name").notNull().default(""),
  toName:      text("to_name").notNull().default(""),
  offered:     jsonb("offered").notNull(),    // { cash, tileIds, jailCards }
  requested:   jsonb("requested").notNull(),  // { cash, tileIds, jailCards }
  accepted:    boolean("accepted").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("trade_history_game_idx").on(t.gameId),
  index("trade_history_from_idx").on(t.fromUserId),
  index("trade_history_to_idx").on(t.toUserId),
  index("trade_history_created_idx").on(t.createdAt),
]);

// ── Audit Log (DB-3) ──────────────────────────────────────────────────────────
// Traces all admin/moderator actions (ban, unban, item changes, coin grants).
export const auditLog = pgTable("audit_log", {
  id:           text("id").primaryKey().$defaultFn(() => randomUUID()),
  adminUserId:  text("admin_user_id").references(() => profiles.id, { onDelete: "set null" }),
  action:       text("action").notNull(),           // 'BAN_USER' | 'UNBAN_USER' | 'GRANT_COINS' | ...
  targetType:   text("target_type").notNull(),      // 'user' | 'store_item' | 'bug_report' | ...
  targetId:     text("target_id").notNull(),
  before:       jsonb("before"),
  after:        jsonb("after"),
  ipAddress:    text("ip_address"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_log_admin_idx").on(t.adminUserId),
  index("audit_log_target_idx").on(t.targetType, t.targetId),
  index("audit_log_created_idx").on(t.createdAt),
]);

// ── Achievements (DB-4) ───────────────────────────────────────────────────────
export const achievements = pgTable("achievements", {
  id:           text("id").primaryKey(),            // slug: 'first_win', 'monopolize', ...
  name:         text("name").notNull(),
  description:  text("description").notNull().default(""),
  iconUrl:      text("icon_url"),
  rewardCoins:  integer("reward_coins").notNull().default(0),
  active:       boolean("active").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const userAchievements = pgTable("user_achievements", {
  id:            text("id").primaryKey().$defaultFn(() => randomUUID()),
  userId:        text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt:    timestamp("unlocked_at").notNull().defaultNow(),
}, (t) => [
  index("user_achievements_user_idx").on(t.userId),
  uniqueIndex("user_achievements_user_ach_unique").on(t.userId, t.achievementId),
]);
