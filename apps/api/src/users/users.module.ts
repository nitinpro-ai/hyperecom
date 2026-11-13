import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AuthModule } from "../auth/auth.module";

/**
 * M02 — Users, Profiles & RBAC. Owns users/roles/addresses tables (D-015).
 * Imports AuthModule for the JwtAuthGuard on /me routes.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
