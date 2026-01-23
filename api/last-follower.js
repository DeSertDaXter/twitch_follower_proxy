// api/last-follower.js
import { getAccessToken } from "../lib/twitchAuth.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Client-ID");
}

function sendAuthError(res, e) {
  const code = e?.code || "AUTH_ERROR";
  const status =
    code === "NO_TOKENS" || code === "NO_REFRESH_TOKEN" || code === "REFRESH_FAILED" ? 401 :
    code === "MISSING_TWITCH_CLIENT" ? 500 :
    500;

  return res.status(status).json({
    ok: false,
    error: code,
    message: String(e?.message || e),
    hint: "Open /api/auth/login to (re)authorize and store tokens in KV.",
    status_code: e?.status,
    detail: e?.detail,
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const broadcasterId =
      String(req.query.broadcaster_id || "").trim() ||
      String(process.env.TWITCH_BROADCASTER_ID || "").trim();

    if (!broadcasterId) {
      return res.status(400).json({ ok: false, error: "Missing broadcaster_id" });
    }

    const CLIENT_ID = (process.env.TWITCH_CLIENT_ID || "").trim();
    if (!CLIENT_ID) {
      return res.status(500).json({ ok: false, error: "missing env TWITCH_CLIENT_ID" });
    }

    let token;
    try {
      token = await getAccessToken();
    } catch (e) {
      return sendAuthError(res, e);
    }

    const headers = {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${token}`,
    };

    const moderatorId =
      (process.env.TWITCH_MODERATOR_ID || "").trim() ||
      (process.env.TWITCH_USER_ID || "").trim() ||
      broadcasterId;

    const url = new URL("https://api.twitch.tv/helix/channels/followers");
    url.searchParams.set("broadcaster_id", String(broadcasterId));
    url.searchParams.set("moderator_id", String(moderatorId));
    url.searchParams.set("first", "1");

    const r = await fetch(url.toString(), { headers, cache: "no-store" });
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "last-follower lookup failed",
        detail: j,
        hint:
          "If this is 401/403: ensure the authorized Twitch account has scope 'moderator:read:followers' and moderator_id matches the authorized user (or set TWITCH_MODERATOR_ID/TWITCH_USER_ID).",
      });
    }

    const latest = j?.data?.[0] || null;

    res.setHeader("Cache-Control", "max-age=30");
    return res.status(200).json({
      ok: true,
      broadcaster_id: broadcasterId,
      moderator_id: moderatorId,
      latest,
      total: Number(j?.total) || 0,
    });
  } catch (e) {
    console.error("[last-follower] server error", e);
    return res.status(500).json({
      ok: false,
      error: "internal",
      detail: String(e?.message || e),
    });
  }
}
