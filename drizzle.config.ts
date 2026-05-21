export default {
  schema: "./db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};
