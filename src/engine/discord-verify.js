// Discord interaction checks shared by the Cloudflare Worker and the Node
// match runner (web-standard APIs only, so both run the same code).
const SNOWFLAKE = /^\d{17,20}$/;
const PUBLIC_KEY = /^[a-f0-9]{64}$/i;
const SIGNATURE = /^[a-f0-9]{128}$/i;
const TIMESTAMP = /^\d{1,16}$/;
const MAX_SKEW_SECONDS = 300;

const fromHex = (hex) => Uint8Array.from(hex.match(/../g), (byte) => parseInt(byte, 16));

export const isSnowflake = (value) => SNOWFLAKE.test(value);

export function discordConfigured(applicationId, guildId, publicKey) {
  return SNOWFLAKE.test(applicationId) && SNOWFLAKE.test(guildId) && PUBLIC_KEY.test(publicKey);
}

// True when `body` (the request's raw bytes) carries a current, valid
// Ed25519 signature from the application's public key.
export async function verifyDiscordSignature(publicKey, signature, timestamp, body, now = Date.now()) {
  if (!SIGNATURE.test(signature) || !TIMESTAMP.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  const prefix = new TextEncoder().encode(timestamp);
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix);
  signed.set(body, prefix.length);
  const key = await crypto.subtle.importKey('raw', fromHex(publicKey), 'Ed25519', false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, fromHex(signature), signed);
}
