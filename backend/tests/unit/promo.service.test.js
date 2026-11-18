import { describe, it, expect } from "vitest";
import {
  validatePromoCode,
  applyPromoDiscount,
  listActivePromos,
} from "../../src/services/promo.service.js";

describe("promo.service unit tests", () => {
  it("validates active promo codes and rejects invalid/expired ones", () => {
    expect(validatePromoCode("campus20", 2)).toEqual({
      code: "CAMPUS20",
      discountRate: 0.2,
      minSeats: 2,
      active: true,
    });
    expect(() => validatePromoCode("", 1)).toThrow(
      "Promo code must be a non-empty string",
    );
    expect(() => validatePromoCode("UNKNOWN", 1)).toThrow(
      "Promo code not found",
    );
    expect(() => validatePromoCode("EXPIRED50", 2)).toThrow(
      "Promo code is no longer active",
    );
    expect(() => validatePromoCode("CAMPUS20", 1)).toThrow(
      "Seat quantity does not meet promo requirement",
    );
  });

  it("applies promo discount accurately", () => {
    const result = applyPromoDiscount(700000, "CAMPUS20", 2);
    expect(result).toEqual({
      promoCode: "CAMPUS20",
      discountRate: 0.2,
      discountAmount: 140000,
      finalPrice: 560000,
    });
    expect(() => applyPromoDiscount(0, "CAMPUS20", 2)).toThrow(
      "Subtotal must be a positive number",
    );
  });

  it("lists only active promos", () => {
    expect(listActivePromos()).toEqual([
      { code: "EARLYBIRD10", discountPercent: 10, minSeats: 1 },
      { code: "CAMPUS20", discountPercent: 20, minSeats: 2 },
    ]);
  });
});