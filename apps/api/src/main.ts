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

  // Container port: PORT env (k8s sets 4000), default 4000. API_BASE_URL is the
  // EXTERNAL address (NodePort/ingress) and must NOT drive the listen port.
  const port = Number.parseInt(process.env.PORT ?? "4000", 10);
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 ApnaCity API listening on :${port} (env: ${env.NODE_ENV}, external: ${env.API_BASE_URL})`);
}

void bootstrap();
