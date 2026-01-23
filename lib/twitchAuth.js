// lib/twitchAuth.js
import { kv } from "@vercel/kv";

const TOKEN_KEY = "twitch_tokens_v1";

function authError(code, message, extra = {}) {
  const e = new Error(message);
  e.code = code;
  Object.assign(e, extra);
  return e;
}

export async function saveTokens(data) {
  if (!data?.access_token) {
    throw authError("TOKEN_SAVE_INVALID", "Missing access_token in token response");
  }

  const expiresIn = Number(data.expires_in) || 0;
  const expiresAt = Date.now() + expiresIn * 1000;

  await kv.set(TOKEN_KEY, {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // kann manchmal fehlen -> ok
    expires_at: expiresAt,
    saved_at: Date.now(),
  });
}

export async function getTokenMeta() {
  const tokens = await kv.get(TOKEN_KEY);
  if (!tokens) return null;
  return {
    has_access_token: !!tokens.access_token,
    has_refresh_token: !!tokens.refresh_token,
    expires_at: tokens.expires_at,
    saved_at: tokens.saved_at,
  };
}

export async function getAccessToken() {
  const tokens = await kv.get(TOKEN_KEY);
  if (!tokens) {
    throw authError(
      "NO_TOKENS",
      "No Twitch tokens stored. Run /api/auth/login once to authorize."
    );
  }

  const now = Date.now();
  const expiresAt = Number(tokens.expires_at) || 0;
  const stillValid = now < expiresAt - 60_000;

  // Logging ohne Secrets
  console.log("[twitchAuth] token valid?", stillValid, {
    expires_in_ms: expiresAt - now,
    has_refresh_token: !!tokens.refresh_token,
  });

  if (stillValid && tokens.access_token) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw authError(
      "NO_REFRESH_TOKEN",
      "No refresh_token stored. Re-run /api/auth/login to re-authorize."
    );
  }

  const clientId = (process.env.TWITCH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.TWITCH_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw authError(
      "MISSING_TWITCH_CLIENT",
      "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in env."
    );
  }

  console.log("[twitchAuth] refreshing access token now...");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: params,
  });

  const text = await r.text();
  let fresh = null;
  try { fresh = JSON.parse(text); } catch {}

  if (!r.ok) {
    throw authError(
      "REFRESH_FAILED",
      "Twitch refresh_token exchange failed",
      { status: r.status, detail: fresh || text }
    );
  }

  // Twitch kann refresh_token rotieren; falls nicht geliefert, alten behalten
  const merged = {
    ...fresh,
    refresh_token: fresh?.refresh_token || tokens.refresh_token,
  };

  await saveTokens(merged);

  console.log("[twitchAuth] refresh successful; new token saved");

  return merged.access_token;
}
