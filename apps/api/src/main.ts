import "reflect-metadata";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { loadEnv } from "@apnacity/config";
import { AppModule } from "./app.module";
import { NestFactory } from "@nestjs/core";

// Load .env BEFORE validation — tsx does not auto-load it (Next.js apps do).
// Prefer a local apps/api/.env, fall back to the repo root .env.
for (const candidate of [".env", "../../.env"]) {
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

/**
 * ApnaCity API — NestJS modular monolith (32 modules per COMPLETE-BUILD-GUIDE).
 * Boot rule: env is validated FIRST; invalid config ⇒ refuse to start.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv(); // throws on invalid/missing config (fail-fast)

  const app = await NestFactory.create(AppModule, { logger: ["log", "warn", "error"] });
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();

  const port = Number.parseInt(new URL(env.API_BASE_URL).port || "4000", 10);
  await app.listen(port);
  console.log(`🚀 ApnaCity API ready on ${env.API_BASE_URL} (env: ${env.NODE_ENV})`);
}

void bootstrap();
