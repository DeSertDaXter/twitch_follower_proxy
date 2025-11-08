// /api/last-follower.js (Vercel Serverless Function)
// Aufruf: /api/last-follower?broadcaster_id=123456789
// Env: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET

export default async function handler(req, res) {
  try {
    const { broadcaster_id } = req.query;
    if (!broadcaster_id) {
      return res.status(400).json({ error: "Missing broadcaster_id" });
    }

    // 1) App Access Token holen
    const tokenResp = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res.status(500).json({ error: "token_failed", detail: t });
    }
    const { access_token } = await tokenResp.json();

    // 2) Letzten Follower holen (nur 1 Eintrag)
    const helixResp = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(
        String(broadcaster_id)
      )}&first=1`,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!helixResp.ok) {
      const t = await helixResp.text();
      return res.status(helixResp.status).json({ error: "helix_failed", detail: t });
    }

    const data = await helixResp.json();
    const latest = Array.isArray(data.data) && data.data[0] ? data.data[0] : null;

    return res.status(200).json({
      ok: true,
      latest: latest
        ? {
            user_name: latest.user_name,
            user_login: latest.user_login,
            user_id: latest.user_id,
            followed_at: latest.followed_at,
          }
        : null,
    });
  } catch (e) {
    return res.status(500).json({ error: "internal", detail: String(e && e.message ? e.message : e) });
  }
}
