import { Module } from "@nestjs/common";
import { FeatureFlagsService } from "./feature-flags.service";

/**
 * M29 — Feature Flags (Foundation). Kill switches + gradual rollout.
 * Public API: FeatureFlagsService.eval(keys, context). Table `feature_flags`
 * owned here (D-015). Public GET /flags/eval controller + admin CRUD land with
 * the HTTP layer in Step 4; the port + table are the foundation deliverable.
 */
@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
