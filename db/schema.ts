import { pgTable, text, boolean, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
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
  id:          text("id").primaryKey().$defaultFn(() => randomUUID()),
  title:       text("title").notNull(),
  description: text("description").notNull(),
  ip:          text("ip"),
  userAgent:   text("user_agent"),
  imageUrl:    text("image_url"),
  status:      text("status").notNull().default("open"), // 'open' | 'resolved' | 'wontfix'
  createdAt:   timestamp("created_at").notNull().defaultNow(),
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
]);
