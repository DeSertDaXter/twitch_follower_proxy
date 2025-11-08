// /api/_debug-validate.js
export default async function handler(req, res) {
  try {
    const token = process.env.TWITCH_USER_TOKEN;
    if (!token) return res.status(200).json({ ok: false, reason: "TWITCH_USER_TOKEN missing" });

    const r = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `OAuth ${token}` }, // ja: OAuth, nicht Bearer
    });

    const data = await r.json();
    // Erwartet Felder: client_id, login, user_id, scopes[], expires_in
    return res.status(200).json({ ok: r.ok, validate: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
