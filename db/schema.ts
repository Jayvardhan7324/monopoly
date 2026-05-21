import { pgTable, text, boolean, timestamp, integer, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";

// ── Better Auth core tables ───────────────────────────────────────────────────
// `user` replaces the old `profiles` table. The admin plugin adds
// role / banned / banReason / banExpires. We also keep app-specific fields
// (coins, equippedAvatarItemId) directly on the user row via additionalFields.
export const user = pgTable("user", {
  id:                   text("id").primaryKey(),
  name:                 text("name").notNull(),
  email:                text("email").notNull().unique(),
  emailVerified:        boolean("email_verified").notNull().default(false),
  image:                text("image"),
  // admin plugin
  role:                 text("role").default("user"),
  banned:               boolean("banned").default(false),
  banReason:            text("ban_reason"),
  banExpires:           timestamp("ban_expires"),
  // app-specific
  coins:                integer("coins").notNull().default(500),
  equippedAvatarItemId: text("equipped_avatar_item_id"),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id:             text("id").primaryKey(),
  expiresAt:      timestamp("expires_at").notNull(),
  token:          text("token").notNull().unique(),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
  ipAddress:      text("ip_address"),
  userAgent:      text("user_agent"),
  userId:         text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  // admin plugin: impersonation tracking
  impersonatedBy: text("impersonated_by"),
}, (t) => [
  index("session_user_id_idx").on(t.userId),
  index("session_token_idx").on(t.token),
]);

export const account = pgTable("account", {
  id:                    text("id").primaryKey(),
  accountId:             text("account_id").notNull(),
  providerId:            text("provider_id").notNull(),
  userId:                text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken:           text("access_token"),
  refreshToken:          text("refresh_token"),
  idToken:               text("id_token"),
  accessTokenExpiresAt:  timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope:                 text("scope"),
  password:              text("password"),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("account_user_id_idx").on(t.userId),
  uniqueIndex("account_provider_account_unique").on(t.providerId, t.accountId),
]);

export const verification = pgTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("verification_identifier_idx").on(t.identifier),
]);

// ── Store tables ──────────────────────────────────────────────────────────────
export const storeItem = pgTable("store_item", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  type:        text("type").notNull(), // 'avatar' | 'board_skin' | 'token' | 'profile_pic' | 'misc'
  priceCoins:  integer("price_coins").notNull().default(100),
  assetUrl:    text("asset_url"),
  active:      boolean("active").notNull().default(true),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const purchase = pgTable("purchase", {
  id:          text("id").primaryKey(),
  userId:      text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  itemId:      text("item_id").notNull().references(() => storeItem.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
}, (t) => [
  index("purchase_user_id_idx").on(t.userId),
  uniqueIndex("purchase_user_item_unique").on(t.userId, t.itemId),
]);

// ── Player stats ──────────────────────────────────────────────────────────────
export const profilesStats = pgTable("user_stats", {
  userId:              text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
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
  status:        text("status").notNull().default("open"),
  consentGiven:  boolean("consent_given").notNull().default(false),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("bug_report_status_idx").on(t.status),
  index("bug_report_created_at_idx").on(t.createdAt),
]);

// ── Friendships ───────────────────────────────────────────────────────────────
export const friendships = pgTable("friendships", {
  id:          text("id").primaryKey().$defaultFn(() => randomUUID()),
  requesterId: text("requester_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  addresseeId: text("addressee_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  status:      text("status").notNull().default("pending"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("friendships_requester_id_idx").on(t.requesterId),
  index("friendships_addressee_id_idx").on(t.addresseeId),
  index("friendships_status_idx").on(t.status),
  uniqueIndex("friendships_pair_unique").on(t.requesterId, t.addresseeId),
]);

// ── Game History ──────────────────────────────────────────────────────────────
export const gameHistory = pgTable("game_history", {
  id:              text("id").primaryKey().$defaultFn(() => randomUUID()),
  roomId:          text("room_id").notNull(),
  hostUserId:      text("host_user_id").references(() => user.id, { onDelete: "set null" }),
  winnerUserId:    text("winner_user_id").references(() => user.id, { onDelete: "set null" }),
  players:         jsonb("players").notNull(),
  finalNetWorth:   jsonb("final_net_worth"),
  startedAt:       timestamp("started_at").notNull(),
  endedAt:         timestamp("ended_at").notNull().defaultNow(),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  turnsPlayed:     integer("turns_played").notNull().default(0),
}, (t) => [
  index("game_history_winner_idx").on(t.winnerUserId),
  index("game_history_host_idx").on(t.hostUserId),
  index("game_history_ended_idx").on(t.endedAt),
]);

// ── Trade History ─────────────────────────────────────────────────────────────
export const tradeHistory = pgTable("trade_history", {
  id:          text("id").primaryKey().$defaultFn(() => randomUUID()),
  gameId:      text("game_id").references(() => gameHistory.id, { onDelete: "cascade" }),
  roomId:      text("room_id").notNull(),
  fromUserId:  text("from_user_id").references(() => user.id, { onDelete: "set null" }),
  toUserId:    text("to_user_id").references(() => user.id, { onDelete: "set null" }),
  fromName:    text("from_name").notNull().default(""),
  toName:      text("to_name").notNull().default(""),
  offered:     jsonb("offered").notNull(),
  requested:   jsonb("requested").notNull(),
  accepted:    boolean("accepted").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("trade_history_game_idx").on(t.gameId),
  index("trade_history_from_idx").on(t.fromUserId),
  index("trade_history_to_idx").on(t.toUserId),
  index("trade_history_created_idx").on(t.createdAt),
]);

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id:           text("id").primaryKey().$defaultFn(() => randomUUID()),
  adminUserId:  text("admin_user_id").references(() => user.id, { onDelete: "set null" }),
  action:       text("action").notNull(),
  targetType:   text("target_type").notNull(),
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

// ── Achievements ──────────────────────────────────────────────────────────────
export const achievements = pgTable("achievements", {
  id:           text("id").primaryKey(),
  name:         text("name").notNull(),
  description:  text("description").notNull().default(""),
  iconUrl:      text("icon_url"),
  rewardCoins:  integer("reward_coins").notNull().default(0),
  active:       boolean("active").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const userAchievements = pgTable("user_achievements", {
  id:            text("id").primaryKey().$defaultFn(() => randomUUID()),
  userId:        text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt:    timestamp("unlocked_at").notNull().defaultNow(),
}, (t) => [
  index("user_achievements_user_idx").on(t.userId),
  uniqueIndex("user_achievements_user_ach_unique").on(t.userId, t.achievementId),
]);

// ── Admin Boards ──────────────────────────────────────────────────────────────
export const adminBoard = pgTable("admin_board", {
  id:        text("id").primaryKey().$defaultFn(() => randomUUID()),
  name:      text("name").notNull(),
  boardSize: integer("board_size").notNull().default(40),
  tiles:     jsonb("tiles").notNull(),
  isActive:  boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("admin_board_active_idx").on(t.isActive),
]);

// ── Ads ───────────────────────────────────────────────────────────────────────
// Lightweight ad records the admin panel can manage. Each row is one creative
// pinned to a placement slot (header, footer, lobby_top, lobby_side, etc.).
// Production rendering only allows HTTPS image creatives. `htmlSnippet` is kept
// for old rows/migration compatibility, but the server rejects and hides it.
export const ad = pgTable("ad", {
  id:          text("id").primaryKey().$defaultFn(() => randomUUID()),
  name:        text("name").notNull(),
  placement:   text("placement").notNull(),
  imageUrl:    text("image_url"),
  linkUrl:     text("link_url"),
  htmlSnippet: text("html_snippet"),
  altText:     text("alt_text"),
  weight:      integer("weight").notNull().default(1),
  enabled:     boolean("enabled").notNull().default(true),
  impressions: integer("impressions").notNull().default(0),
  clicks:      integer("clicks").notNull().default(0),
  startsAt:    timestamp("starts_at"),
  endsAt:      timestamp("ends_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("ad_placement_idx").on(t.placement),
  index("ad_enabled_idx").on(t.enabled),
]);

// Global application settings. Values are edited by admins through the server
// and read by public endpoints for app-wide visuals/configuration.
export const appSetting = pgTable("app_setting", {
  key:       text("key").primaryKey(),
  value:     jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Back-compat alias ─────────────────────────────────────────────────────────
// Some older call sites still reference `profiles`. Keep the export name so we
// can migrate imports one file at a time.
export const profiles = user;
