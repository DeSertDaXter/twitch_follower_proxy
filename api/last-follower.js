export default async function handler(req, res) {
  try {
    const { broadcaster_id } = req.query;
    if (!broadcaster_id) {
      return res.status(400).json({ error: "Missing broadcaster_id" });
    }

    // --- ENV prüfen: wir brauchen ein USER-Token mit Scope moderator:read:followers
    const CLIENT_ID   = process.env.TWITCH_CLIENT_ID;
    const USER_TOKEN  = process.env.TWITCH_USER_TOKEN; // User-Access-Token (nicht App-Token!)
    const MODERATOR_ID= process.env.TWITCH_USER_ID;    // die User-ID des Token-Inhabers

    if (!CLIENT_ID || !USER_TOKEN) {
      return res.status(500).json({
        error: "missing_env",
        detail: "TWITCH_CLIENT_ID or TWITCH_USER_TOKEN not set",
      });
    }

    const hdrs = {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${USER_TOKEN}`,
    };

    // 1) User prüfen (Optional, aber hilfreich fürs Debuggen)
    let userOk = false;
    try {
      const whoResp = await fetch(
        `https://api.twitch.tv/helix/users?id=${encodeURIComponent(String(broadcaster_id))}`,
        { headers: hdrs, cache: "no-store" }
      );
      const whoJson = await whoResp.json().catch(() => ({}));
      userOk = Array.isArray(whoJson?.data) && whoJson.data.length > 0;
    } catch { /* ignoriere */ }

    // 2) Neuere Route: channels/followers (first=1) – MIT moderator_id!
    let latest = null;
    let total = 0;

    const chUrl = new URL("https://api.twitch.tv/helix/channels/followers");
    chUrl.searchParams.set("broadcaster_id", String(broadcaster_id));
    chUrl.searchParams.set("first", "1");
    if (MODERATOR_ID) chUrl.searchParams.set("moderator_id", String(MODERATOR_ID));

    const chResp = await fetch(chUrl.toString(), { headers: hdrs, cache: "no-store" });

    if (chResp.ok) {
      const j = await chResp.json();
      total = Number(j.total || 0);
      if (Array.isArray(j.data) && j.data.length > 0) {
        const r = j.data[0];
        latest = {
          user_name:   r.user_name,
          user_login:  r.user_login,
          user_id:     r.user_id,
          followed_at: r.followed_at,
          source:      "channels/followers",
          total,
          userOk,
        };
      }
    } else if (chResp.status === 401 || chResp.status === 403) {
      // Typischer Fehler: falsches Token/Scope → gib lesbare Info zurück
      const msg = await chResp.text().catch(() => "");
      return res.status(403).json({
        error: "forbidden",
        detail: "Make sure TWITCH_USER_TOKEN is a USER token with scope 'moderator:read:followers' and moderator_id is set.",
        upstream: msg,
      });
    }

    // 3) Fallback: users/follows (to_id=...) – liefert u.U. Daten, wird aber von Twitch weniger priorisiert
    if (!latest) {
      const ufUrl = new URL("https://api.twitch.tv/helix/users/follows");
      ufUrl.searchParams.set("to_id", String(broadcaster_id));
      ufUrl.searchParams.set("first", "1");

      const ufResp = await fetch(ufUrl.toString(), { headers: hdrs, cache: "no-store" });
      if (ufResp.ok) {
        const j = await ufResp.json();
        total = Number(j.total || 0);
        if (Array.isArray(j.data) && j.data.length > 0) {
          const r = j.data[0]; // { from_id, from_login?, from_name, followed_at }
          latest = {
            user_name:   r.from_name,
            user_login:  r.from_login || r.from_name,
            user_id:     r.from_id,
            followed_at: r.followed_at,
            source:      "users/follows",
            total,
            userOk,
          };
        }
      }
    }

    return res.status(200).json({ ok: true, latest, total, userOk });
  } catch (e) {
    return res.status(500).json({ error: "internal", detail: String(e?.message || e) });
  }
}
