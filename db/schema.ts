import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

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
  coins:       integer("coins").notNull().default(500),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

// ── Store tables ──────────────────────────────────────────────────────────────
export const storeItem = pgTable("store_item", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  type:        text("type").notNull(), // 'avatar' | 'board_skin' | 'token' | 'misc'
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
});

// ── Player stats ──────────────────────────────────────────────────────────────
export const userStats = pgTable("user_stats", {
  userId:           text("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  gamesPlayed:      integer("games_played").notNull().default(0),
  gamesWon:         integer("games_won").notNull().default(0),
  totalEarnings:    integer("total_earnings").notNull().default(0),
  propertiesBought: integer("properties_bought").notNull().default(0),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});
