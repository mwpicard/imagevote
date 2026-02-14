import { createHash } from "crypto";

/**
 * Generate a coupon code in format DRM-XXXXXX-PPPP-SSSS
 * - XXXXXX = first 6 hex chars of SHA256(lowercase email + secret)
 * - PPPP = priceInCents in hex, zero-padded to 4 chars
 * - SSSS = first 4 hex chars of SHA256(XXXXXX + PPPP + secret)
 */
export function generateCoupon(
  email: string,
  priceInCents: number,
  secret: string
): string {
  const emailHash = createHash("sha256")
    .update(email.toLowerCase().trim() + secret)
    .digest("hex");
  const xxxxxx = emailHash.slice(0, 6).toUpperCase();

  const pppp = priceInCents.toString(16).padStart(4, "0").toUpperCase();

  const sigHash = createHash("sha256")
    .update(xxxxxx + pppp + secret)
    .digest("hex");
  const ssss = sigHash.slice(0, 4).toUpperCase();

  return `DRM-${xxxxxx}-${pppp}-${ssss}`;
}

/**
 * Parse a price string like "49€", "€49", "71.99", "49.00€" into cents.
 * Returns 0 if parsing fails.
 */
export function parsePriceToCents(betaPrice: string): number {
  const cleaned = betaPrice.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return 0;

  // Handle comma as decimal separator (e.g. "49,99")
  const normalized = cleaned.replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value)) return 0;

  return Math.round(value * 100);
}
