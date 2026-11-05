import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  /** Step 1 verify gate: GET {API_BASE_URL}/v1/health must return 200 ok. */
  @Get()
  check(): { status: "ok"; service: string; time: string } {
    return { status: "ok", service: "apnacity-api", time: new Date().toISOString() };
  }
}
