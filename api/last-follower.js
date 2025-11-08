export default async function handler(req, res) {
  try {
    const { broadcaster_id } = req.query;
    if (!broadcaster_id) {
      return res.status(400).json({ error: "Missing broadcaster_id" });
    }

    // 0) App Access Token holen
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
    const hdrs = {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${access_token}`,
    };

    // 1) Sicherstellen, dass die ID wirklich existiert (optional, aber hilfreich)
    const whoResp = await fetch(
      `https://api.twitch.tv/helix/users?id=${encodeURIComponent(String(broadcaster_id))}`,
      { headers: hdrs }
    );
    const whoJson = await whoResp.json();
    const userOk = Array.isArray(whoJson?.data) && whoJson.data.length > 0;

    // 2) Neuere Route: channels/followers (first=1)
    let latest = null;
    let total = 0;

    const chResp = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(
        String(broadcaster_id)
      )}&first=1`,
      { headers: hdrs }
    );

    if (chResp.ok) {
      const j = await chResp.json();
      total = Number(j.total || 0);
      if (Array.isArray(j.data) && j.data.length) {
        const r = j.data[0];
        latest = {
          user_name: r.user_name,
          user_login: r.user_login,
          user_id: r.user_id,
          followed_at: r.followed_at,
          source: "channels/followers",
          total,
          userOk,
        };
      }
    }

    // 3) Fallback: users/follows (to_id=...); liefert oft auch bei App-Token
    if (!latest) {
      const ufResp = await fetch(
        `https://api.twitch.tv/helix/users/follows?to_id=${encodeURIComponent(
          String(broadcaster_id)
        )}&first=1`,
        { headers: hdrs }
      );
      if (ufResp.ok) {
        const j = await ufResp.json();
        total = Number(j.total || 0);
        if (Array.isArray(j.data) && j.data.length) {
          const r = j.data[0]; // fields: from_id, from_name, followed_at
          latest = {
            user_name: r.from_name,
            user_login: r.from_login || r.from_name,
            user_id: r.from_id,
            followed_at: r.followed_at,
            source: "users/follows",
            total,
            userOk,
          };
        }
      }
    }

    return res.status(200).json({ ok: true, latest, total, userOk });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "internal", detail: String(e?.message || e) });
  }
}
