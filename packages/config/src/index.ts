import { z } from "zod";

/**
 * ApnaCity environment schema — single source of truth for configuration.
 * ALL apps validate process.env through this schema at boot; missing/invalid
 * values => the app refuses to start (fail-fast, per docs/COMPLETE-BUILD-GUIDE §V3).
 */
const bool = z
  .string()
  .transform((v) => v === "true" || v === "1")
  .default("false");

const int = (def: number) =>
  z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int())
    .default(String(def));

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  WEB_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_DOMAIN: z.string().default("apnacity.com"),
  TENANT_RESOLVE_HMAC_SECRET: z.string().min(16),

  // database
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: int(20),

  // redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // storage
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET_PUBLIC: z.string().default("apnacity-media"),
  S3_BUCKET_PRIVATE: z.string().default("apnacity-docs"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  CDN_BASE_URL: z.string().default(""),

  // auth
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: int(900),
  REFRESH_SECRET: z.string().min(16),
  OTP_HASH_PEPPER: z.string().min(16),

  // payments
  PAYMENT_PROVIDER: z.enum(["cashfree", "razorpay"]).default("cashfree"),
  CASHFREE_APP_ID: z.string().default(""),
  CASHFREE_SECRET_KEY: z.string().default(""),
  CASHFREE_WEBHOOK_SECRET: z.string().default(""),

  // notifications
  DLT_SMS_PROVIDER: z.string().default(""),
  DLT_SENDER_ID: z.string().default(""),
  DLT_API_KEY: z.string().default(""),
  WHATSAPP_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_ID: z.string().default(""),
  FCM_SERVER_KEY: z.string().default(""),
  APNS_KEY_ID: z.string().default(""),
  APNS_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("no-reply@apnacity.com"),
  SMTP_URL: z.string().default("smtp://localhost:1025"),

  // maps
  GEO_PROVIDER: z.enum(["google", "mapbox"]).default("google"),
  GOOGLE_MAPS_KEY: z.string().default(""),

  // misc
  SENTRY_DSN: z.string().default(""),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(""),
  FEATURE_FLAG_DEFAULTS: z.string().default("{}"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and return the environment. Throws with a readable report listing
 * every invalid/missing variable so misconfiguration is obvious at boot.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment configuration — refusing to start:\n${issues}\n` +
        `Fix these values in .env (see .env.example).`
    );
  }
  return result.data;
}

/** True when running locally (docker-compose stack, mailpit, minio…). */
export function isDev(env: Env): boolean {
  return env.NODE_ENV === "development";
}
