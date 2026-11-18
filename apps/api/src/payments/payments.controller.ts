import { Controller, Headers, HttpCode, HttpException, Inject, Post, Req } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

/** M15 — provider webhook. Public by design: authenticity = HMAC signature over the raw body. */
@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: { rawBody?: Buffer; body?: unknown },
    @Headers("x-webhook-signature") signature: string | undefined,
  ) {
    const raw = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body ?? {});
    const r = await this.payments.handleWebhook(raw, signature ?? "");
    if (!r.ok) {
      const code = r.reason === "BAD_SIGNATURE" ? 401 : r.reason === "UNKNOWN_PAYMENT" ? 404 : 422;
      throw new HttpException(r.reason, code);
    }
    return r;
  }
}
