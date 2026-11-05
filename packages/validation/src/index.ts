import { z } from "zod";

/**
 * Shared Zod schemas — used by BOTH frontend forms and backend DTO validation
 * (one contract, per docs/COMPLETE-BUILD-GUIDE §PART IV "Shared packages").
 * Money is always integer paise; phone is E.164 (+91…).
 */

export const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, "Phone must be a valid Indian mobile (+91XXXXXXXXXX)");

export const otpSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

export const pincodeSchema = z.string().regex(/^\d{6}$/, "Pincode must be 6 digits");

export const paiseSchema = z
  .number()
  .int("Money must be integer paise")
  .nonnegative();

/** Positive quantity with sane cap (cart/stock/order lines). */
export const quantitySchema = z.number().int().min(1).max(999);

export const addressInputSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  line1: z.string().min(3).max(120),
  line2: z.string().max(120).optional(),
  landmark: z.string().max(80).optional(),
  pincode: pincodeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

export const addresIdSchema = z.string().uuid();

/** Product wizard (W2) — publish payload validated on the seller portal AND api. */
export const listingDraftSchema = z.object({
  productId: z.string().uuid().optional(),       // attach to existing master
  name: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  attributes: z.record(z.string()).default({}),  // validated against category schema later
  variants: z
    .array(
      z.object({
        sellerSku: z.string().min(1).max(40),
        mrpPaise: paiseSchema,
        pricePaise: paiseSchema,
        taxRateBp: z.number().int().min(0).max(10000).default(0),
        stockQty: z.number().int().min(0).max(100000),
      })
    )
    .min(1, "At least one variant is required"),
});

export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({ phone: phoneSchema, otp: otpSchema });

export const cartItemSchema = z.object({
  listingVariantId: z.string().uuid(),
  quantity: quantitySchema,
});

export const checkoutQuoteSchema = z.object({
  cartId: z.string().uuid(),
  addressId: z.string().uuid(),
  couponCode: z.string().max(30).optional(),
});

export const placeOrderSchema = z.object({
  quoteId: z.string().uuid(),
});

export type AddressInput = z.infer<typeof addressInputSchema>;
export type ListingDraft = z.infer<typeof listingDraftSchema>;
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>;
