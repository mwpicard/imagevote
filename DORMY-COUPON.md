# Dormy Coupon Integration

## Overview
After a user completes the survey, generate a personalized Dormy discount coupon code tied to their email. The coupon encodes the discounted price and is verified on the Dormy shop at `dormy.re/shop.html`.

## Generator Location
`src/lib/coupon-generator.ts`

## Usage
```ts
import { generateCoupon } from "@/lib/coupon-generator";

const code = generateCoupon(
  email,                          // user's email from the survey
  priceInCents,                   // discounted price in EUR cents (e.g. 4900 = €49.00)
  process.env.COUPON_SECRET!      // shared secret from .env
);
// Returns e.g. "DRM-A3F2B1-1324-8D2E"
```

## Environment Variable
Add to `.env`:
```
COUPON_SECRET=dormy-survey-2024-secret
```
This must match the `COUPON_SECRET` in the Dormy project's `.env`.

## Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `email` | string | Survey respondent's email. Automatically lowercased and trimmed. |
| `priceInCents` | number | The actual EUR price the user pays, in cents. Not a discount percentage. |
| `secret` | string | Shared secret from `process.env.COUPON_SECRET`. |

## Price Examples
| Scenario | `priceInCents` | User pays |
|----------|---------------|-----------|
| €49 deal | `4900` | €49.00 |
| €59 deal | `5900` | €59.00 |
| €71.99 deal | `7199` | €71.99 |

## How It Works
1. Survey collects user's email and determines their discount price
2. Call `generateCoupon(email, priceInCents, secret)` to produce a unique code
3. Display the code to the user (e.g. on a thank-you page or in a follow-up email)
4. User enters the code on the Dormy shop page (`dormy.re/shop.html`)
5. Dormy server verifies the code, extracts the price, and shows the discounted amount
6. Discounted price carries through to Stripe checkout

## Code Format
`DRM-XXXXXX-PPPP-SSSS`
- `XXXXXX` — 6 hex chars derived from SHA256(email + secret), unique per person
- `PPPP` — price in cents, hex-encoded
- `SSSS` — 4 char signature proving the code was generated with the correct secret

## Important
- Each email produces a different code even at the same price
- The code is deterministic: same email + same price + same secret = same code every time
- Do NOT expose `COUPON_SECRET` in client-side code — generate codes server-side only
