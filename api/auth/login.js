export default function handler(req, res) {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const redirectUri = process.env.TWITCH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        error: "missing_env",
        TWITCH_CLIENT_ID_set: !!clientId,
        TWITCH_REDIRECT_URI: redirectUri || null,
        hint: "Set TWITCH_REDIRECT_URI to: https://<your-domain>/api/auth/callback (no quotes)",
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "moderator:read:followers",
    });

    return res.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
  } catch (e) {
    return res.status(500).json({
      error: "login_crashed",
      detail: String(e?.message || e),
      stack: String(e?.stack || ""),
    });
  }
}
