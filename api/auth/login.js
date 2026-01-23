export default function handler(req, res) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: "missing_env",
      missing: {
        TWITCH_CLIENT_ID: !clientId,
        TWITCH_REDIRECT_URI: !redirectUri,
      },
    });
  }

  // DEBUG: optional per ?debug=1 anzeigen
  if (req.query.debug === "1") {
    return res.status(200).json({
      ok: true,
      using: {
        TWITCH_CLIENT_ID: clientId,
        TWITCH_REDIRECT_URI: redirectUri,
      },
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "moderator:read:followers",
  });

  return res.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
}
