import { pgTable, text, boolean, timestamp, integer, real } from "drizzle-orm/pg-core";

// ── Better Auth core tables ───────────────────────────────────────────────────

export const user = pgTable("user", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image:         text("image"),
  createdAt:     timestamp("created_at").notNull(),
  updatedAt:     timestamp("updated_at").notNull(),
  // better-auth admin plugin fields
  role:          text("role").default("user"),
  banned:        boolean("banned").default(false),
  banReason:     text("ban_reason"),
  banExpires:    timestamp("ban_expires"),
  // game-specific
  coins:         integer("coins").notNull().default(500),
});

export const session = pgTable("session", {
  id:          text("id").primaryKey(),
  expiresAt:   timestamp("expires_at").notNull(),
  token:       text("token").notNull().unique(),
  createdAt:   timestamp("created_at").notNull(),
  updatedAt:   timestamp("updated_at").notNull(),
  ipAddress:   text("ip_address"),
  userAgent:   text("user_agent"),
  userId:      text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id:                     text("id").primaryKey(),
  accountId:              text("account_id").notNull(),
  providerId:             text("provider_id").notNull(),
  userId:                 text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken:            text("access_token"),
  refreshToken:           text("refresh_token"),
  idToken:                text("id_token"),
  accessTokenExpiresAt:   timestamp("access_token_expires_at"),
  refreshTokenExpiresAt:  timestamp("refresh_token_expires_at"),
  scope:                  text("scope"),
  password:               text("password"),
  createdAt:              timestamp("created_at").notNull(),
  updatedAt:              timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdAt:  timestamp("created_at"),
  updatedAt:  timestamp("updated_at"),
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
  userId:      text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  itemId:      text("item_id").notNull().references(() => storeItem.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at").notNull(),
});
