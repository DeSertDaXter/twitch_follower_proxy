// api/followers.js
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
    const { login, id } = req.query;
    if (!login && !id) {
      return res.status(400).json({ ok: false, error: "missing login or id" });
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

    // broadcasterId bestimmen
    let broadcasterId = id ? String(id) : null;

    if (!broadcasterId) {
      const uRes = await fetch(
        "https://api.twitch.tv/helix/users?login=" + encodeURIComponent(String(login)),
        { headers, cache: "no-store" }
      );
      const u = await uRes.json().catch(() => ({}));

      if (!uRes.ok) {
        return res.status(502).json({
          ok: false,
          error: "users lookup failed",
          detail: u,
        });
      }

      broadcasterId = u?.data?.[0]?.id || null;
      if (!broadcasterId) {
        return res.status(404).json({ ok: false, error: "user not found" });
      }
    }

    // Helix requires moderator_id
    const moderatorId =
      (process.env.TWITCH_MODERATOR_ID || "").trim() ||
      (process.env.TWITCH_USER_ID || "").trim() ||
      broadcasterId;

    const url = new URL("https://api.twitch.tv/helix/channels/followers");
    url.searchParams.set("broadcaster_id", String(broadcasterId));
    url.searchParams.set("moderator_id", String(moderatorId));

    const fRes = await fetch(url.toString(), { headers, cache: "no-store" });
    const f = await fRes.json().catch(() => ({}));

    if (!fRes.ok) {
      // Häufigster Fall: 401/403 wenn scope/moderator_id nicht passt
      return res.status(fRes.status).json({
        ok: false,
        error: "followers lookup failed",
        detail: f,
        hint:
          "If this is 401/403: ensure the authorized Twitch account has scope 'moderator:read:followers' and moderator_id matches the authorized user (or set TWITCH_MODERATOR_ID/TWITCH_USER_ID).",
      });
    }

    res.setHeader("Cache-Control", "max-age=60");
    return res.status(200).json({
      ok: true,
      broadcaster_id: broadcasterId,
      moderator_id: moderatorId,
      total: Number(f?.total) || 0,
    });
  } catch (e) {
    console.error("[followers] server error", e);
    return res.status(500).json({
      ok: false,
      error: "server error",
      detail: String(e?.message || e),
    });
  }
}
