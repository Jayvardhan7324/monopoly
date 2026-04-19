import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "../db";
import * as schema from "../db/schema";

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

// Always include the configured baseURL in trustedOrigins so Better Auth never
// rejects requests as "Invalid origin" when the browser hits the same URL the
// server thinks it lives at.
const trustedOrigins = Array.from(new Set([
  baseURL,
  ...(process.env.ALLOWED_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) || []),
  "http://localhost:3000",
  "http://localhost:5173",
]));

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Cashly <onboarding@resend.dev>";
  if (!apiKey) {
    console.log(`[email:dev] To: ${to}\nSubject: ${subject}\n${html}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) console.error("[email] Resend failed:", res.status, await res.text());
}

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    minPasswordLength: 8,
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Verify your Cashly email",
        `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2>Welcome to Cashly, ${user.name || "player"}!</h2>
          <p>Click the button below to verify your email address.</p>
          <p><a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Verify email</a></p>
          <p style="color:#666;font-size:12px">Or paste this URL: ${url}</p>
        </div>`
      );
    },
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
            appBundleIdentifier: process.env.APPLE_APP_BUNDLE_ID,
          },
        }
      : {}),
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
          },
        }
      : {}),
  },

  user: {
    additionalFields: {
      coins:                { type: "number", required: false, defaultValue: 500, input: false },
      equippedAvatarItemId: { type: "string", required: false, input: false },
    },
  },

  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
