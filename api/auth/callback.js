import { saveTokens } from "../../lib/twitchAuth.js";

export default async function handler(req, res) {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: "missing_code", query: req.query });
    }

    const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
    const REDIRECT_URI = process.env.TWITCH_REDIRECT_URI;

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).json({
        error: "missing_env",
        missing: {
          TWITCH_CLIENT_ID: !CLIENT_ID,
          TWITCH_CLIENT_SECRET: !CLIENT_SECRET,
          TWITCH_REDIRECT_URI: !REDIRECT_URI,
        },
      });
    }

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: String(code),
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });

    const tokenResp = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body,
    });

    const tokenText = await tokenResp.text();
    let tokenJson = null;
    try { tokenJson = JSON.parse(tokenText); } catch {}

    if (!tokenResp.ok) {
      return res.status(500).json({
        error: "twitch_token_exchange_failed",
        status: tokenResp.status,
        response: tokenJson || tokenText,
        redirect_uri_used: REDIRECT_URI,
      });
    }

    // Speichern (KV / whatever dein saveTokens macht)
    await saveTokens(tokenJson);

    return res.status(200).json({ ok: true, saved: true });
  } catch (err) {
    console.error("CALLBACK_CRASH", err);
    return res.status(500).json({
      error: "callback_crashed",
      detail: String(err?.message || err),
      stack: err?.stack,
    });
  }
}
