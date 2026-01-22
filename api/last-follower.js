import { getAccessToken } from "../lib/twitchAuth.js";

export default async function handler(req, res) {
  // --- CORS erlauben
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Client-ID");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const broadcasterId = req.query.broadcaster_id || process.env.TWITCH_BROADCASTER_ID;
    if (!broadcasterId) {
      return res.status(400).json({ ok: false, error: "Missing broadcaster_id" });
    }

    const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    if (!CLIENT_ID) return res.status(500).json({ ok: false, error: "missing env TWITCH_CLIENT_ID" });

    const token = await getAccessToken();

    const headers = {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${token}`,
    };

    const moderatorId = process.env.TWITCH_MODERATOR_ID || broadcasterId;

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
        hint: "Wenn das 401 ist: /api/auth/login einmal ausführen, damit Tokens in KV gespeichert sind.",
      });
    }

    const latest = j?.data?.[0] || null;
    return res.status(200).json({ ok: true, latest, total: Number(j.total) || 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "internal", detail: String(e?.message || e) });
  }
}
