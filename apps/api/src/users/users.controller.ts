import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { UsersService, type AddressInput } from "./users.service";
import { JwtAuthGuard, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";

/** M02 — /me profile + addresses. All routes require a valid access token. */
@Controller("me")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() user: AccessClaims) {
    const profile = await this.users.me(user.sub);
    if (!profile) throw new NotFoundException("user not found");
    return profile;
  }

  @Get("addresses")
  listAddresses(@CurrentUser() user: AccessClaims) {
    return this.users.listAddresses(user.sub);
  }

  @Post("addresses")
  addAddress(@CurrentUser() user: AccessClaims, @Body() dto: AddressInput) {
    return this.users.addAddress(user.sub, dto);
  }

  @Delete("addresses/:id")
  async deleteAddress(@CurrentUser() user: AccessClaims, @Param("id") id: string) {
    const ok = await this.users.deleteAddress(user.sub, id);
    if (!ok) throw new NotFoundException("address not found");
    return { deleted: true };
  }
}
