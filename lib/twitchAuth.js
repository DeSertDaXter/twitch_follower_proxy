import { kv } from "@vercel/kv";

const TOKEN_KEY = "twitch_tokens_v1";

export async function saveTokens(data) {
  const expiresAt = Date.now() + data.expires_in * 1000;

  await kv.set(TOKEN_KEY, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
  });
}

export async function getAccessToken() {
  const tokens = await kv.get(TOKEN_KEY);
  if (!tokens) throw new Error("No Twitch tokens stored");

  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  // 🔁 Token automatisch erneuern
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
  });

  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: params,
  });

  const fresh = await r.json();
  await saveTokens(fresh);

  return fresh.access_token;
}
