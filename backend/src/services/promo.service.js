export const PROMO_CODES = {
  EARLYBIRD10: { discountRate: 0.1, minSeats: 1, active: true },
  CAMPUS20: { discountRate: 0.2, minSeats: 2, active: true },
  EXPIRED50: { discountRate: 0.5, minSeats: 1, active: false },
};

export function validatePromoCode(code, seatQty) {
  if (!code || typeof code !== "string") {
    throw new Error("Promo code must be a non-empty string");
  }
  const normalized = code.trim().toUpperCase();
  const promo = PROMO_CODES[normalized];
  if (!promo) {
    throw new Error("Promo code not found");
  }
  if (!promo.active) {
    throw new Error("Promo code is no longer active");
  }
  if (!Number.isInteger(seatQty) || seatQty < promo.minSeats) {
    throw new Error("Seat quantity does not meet promo requirement");
  }
  return { code: normalized, ...promo };
}

export function applyPromoDiscount(subtotal, code, seatQty) {
  if (typeof subtotal !== "number" || subtotal <= 0) {
    throw new Error("Subtotal must be a positive number");
  }
  const promo = validatePromoCode(code, seatQty);
  const discountAmount = Math.round(subtotal * promo.discountRate);
  const finalPrice = Math.max(0, subtotal - discountAmount);
  return {
    promoCode: promo.code,
    discountRate: promo.discountRate,
    discountAmount,
    finalPrice,
  };
}

export function listActivePromos() {
  return Object.entries(PROMO_CODES)
    .filter(([, details]) => details.active)
    .map(([code, details]) => ({
      code,
      discountPercent: Math.round(details.discountRate * 100),
      minSeats: details.minSeats,
    }));
}