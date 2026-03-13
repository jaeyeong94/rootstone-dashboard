import crypto from "crypto";

const RECV_WINDOW = "5000";

/**
 * Generate HMAC-SHA256 signature for Bybit API v5
 */
export function createSignature(
  timestamp: string,
  apiKey: string,
  queryString: string,
  apiSecret: string
): string {
  const paramStr = timestamp + apiKey + RECV_WINDOW + queryString;
  return crypto
    .createHmac("sha256", apiSecret)
    .update(paramStr)
    .digest("hex");
}

/**
 * Build authenticated headers for Bybit API
 */
export function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.BYBIT_API_KEY?.trim();
  const apiSecret = process.env.BYBIT_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    throw new Error("BYBIT_API_KEY and BYBIT_API_SECRET must be set");
  }

  const timestamp = Date.now().toString();
  // Empty string for GET requests without query params
  const signature = createSignature(timestamp, apiKey, "", apiSecret);

  return {
    "X-BAPI-API-KEY": apiKey,
    "X-BAPI-SIGN": signature,
    "X-BAPI-TIMESTAMP": timestamp,
    "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    "Content-Type": "application/json",
  };
}

/**
 * Build authenticated headers with query string
 */
export function getAuthHeadersWithQuery(
  queryString: string
): Record<string, string> {
  const apiKey = process.env.BYBIT_API_KEY?.trim();
  const apiSecret = process.env.BYBIT_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    throw new Error("BYBIT_API_KEY and BYBIT_API_SECRET must be set");
  }

  const timestamp = Date.now().toString();
  const signature = createSignature(timestamp, apiKey, queryString, apiSecret);

  return {
    "X-BAPI-API-KEY": apiKey,
    "X-BAPI-SIGN": signature,
    "X-BAPI-TIMESTAMP": timestamp,
    "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    "Content-Type": "application/json",
  };
}
