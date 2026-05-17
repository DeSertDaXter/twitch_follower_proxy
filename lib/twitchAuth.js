import { kv } from "@vercel/kv";

const TOKEN_KEY = "twitch_tokens_v1";

function makeError(code, message, detail = undefined, status = undefined) {
  const err = new Error(message);
  err.code = code;
  err.detail = detail;
  err.status = status;
  return err;
}

export async function saveTokens(data) {
  if (!data?.access_token) {
    throw makeError("INVALID_TOKEN_DATA", "No access_token in Twitch token response", data);
  }

  const expiresIn = Number(data.expires_in || 0);
  const expiresAt = Date.now() + expiresIn * 1000;

  const existing = await kv.get(TOKEN_KEY);

  await kv.set(TOKEN_KEY, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || existing?.refresh_token || null,
    expires_at: expiresAt,
    saved_at: Date.now(),
    scope: data.scope || null,
    token_type: data.token_type || null,
  });
}

export async function getTokenMeta() {
  const tokens = await kv.get(TOKEN_KEY);

  if (!tokens) {
    return {
      has_tokens: false,
    };
  }

  return {
    has_tokens: true,
    has_access_token: !!tokens.access_token,
    has_refresh_token: !!tokens.refresh_token,
    expires_at: tokens.expires_at || null,
    expires_in_seconds: tokens.expires_at
      ? Math.round((tokens.expires_at - Date.now()) / 1000)
      : null,
    saved_at: tokens.saved_at || null,
    scope: tokens.scope || null,
    token_type: tokens.token_type || null,
  };
}

export async function getAccessToken() {
  const tokens = await kv.get(TOKEN_KEY);

  if (!tokens) {
    throw makeError("NO_TOKENS", "No Twitch tokens stored");
  }

  if (!tokens.access_token) {
    throw makeError("NO_ACCESS_TOKEN", "Stored Twitch token data has no access_token", tokens);
  }

  if (Date.now() < Number(tokens.expires_at || 0) - 60_000) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw makeError("NO_REFRESH_TOKEN", "Stored Twitch token data has no refresh_token");
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw makeError("MISSING_TWITCH_ENV", "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET", {
      has_client_id: !!clientId,
      has_client_secret: !!clientSecret,
    });
  }

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
  let fresh;

  try {
    fresh = JSON.parse(text);
  } catch {
    fresh = { raw: text };
  }

  if (!r.ok) {
    throw makeError("REFRESH_FAILED", "Twitch token refresh failed", fresh, r.status);
  }

  await saveTokens(fresh);

  return fresh.access_token;
}