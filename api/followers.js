import { getAccessToken } from "../lib/twitchAuth.js";

export default async function handler(req, res) {
  // --- CORS erlauben + Preflight beantworten
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Client-ID");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { login, id } = req.query;
    if (!login && !id) return res.status(400).json({ ok: false, error: "missing login or id" });

    const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    if (!CLIENT_ID) return res.status(500).json({ ok: false, error: "missing env TWITCH_CLIENT_ID" });

    // Token kommt jetzt aus KV (und wird bei Bedarf automatisch refreshed)
    const token = await getAccessToken();

    const baseHeaders = {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${token}`,
    };

    // broadcasterId ermitteln
    let broadcasterId = id;
    if (!broadcasterId) {
      const uRes = await fetch(
        "https://api.twitch.tv/helix/users?login=" + encodeURIComponent(login),
        { headers: baseHeaders, cache: "no-store" }
      );
      const u = await uRes.json().catch(() => ({}));
      if (!uRes.ok) return res.status(502).json({ ok: false, error: "users lookup failed", detail: u });
      broadcasterId = u.data?.[0]?.id;
      if (!broadcasterId) return res.status(404).json({ ok: false, error: "user not found" });
    }

    // Helix requires moderator_id (für channels/followers)
    const moderatorId = process.env.TWITCH_MODERATOR_ID || broadcasterId;

    const url = new URL("https://api.twitch.tv/helix/channels/followers");
    url.searchParams.set("broadcaster_id", String(broadcasterId));
    url.searchParams.set("moderator_id", String(moderatorId));

    const fRes = await fetch(url.toString(), { headers: baseHeaders, cache: "no-store" });
    const f = await fRes.json().catch(() => ({}));
    if (!fRes.ok) {
      return res.status(fRes.status).json({
        ok: false,
        error: "followers lookup failed",
        detail: f,
        hint: "Wenn das 401 ist: /api/auth/login einmal ausführen, damit Tokens in KV gespeichert sind.",
      });
    }

    res.setHeader("Cache-Control", "max-age=60");
    return res.status(200).json({ ok: true, broadcaster_id: broadcasterId, total: Number(f.total) || 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server error", detail: String(e?.message || e) });
  }
}
