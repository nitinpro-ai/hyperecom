import { describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";

/**
 * BOOT / DI-GRAPH test — the gap that let DI errors reach the cluster.
 * Test.createTestingModule(AppModule).compile() instantiates the ENTIRE
 * dependency-injection graph exactly like `node dist/main.js` does, so any
 * unresolvable constructor param (interface types, defaulted params, missing
 * providers) fails HERE in CI instead of in a crash-looping pod.
 *
 * Note: this exercises the same provider wiring the compiled build uses; it is
 * the fast local equivalent of booting the container.
 */
describe("AppModule DI graph (boot test)", () => {
  it("compiles the full module graph with no unresolved dependencies", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
