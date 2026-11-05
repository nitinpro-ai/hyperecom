import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns ok with service name and timestamp", () => {
    const result = new HealthController().check();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("apnacity-api");
    expect(new Date(result.time).toString()).not.toBe("Invalid Date");
  });
});
