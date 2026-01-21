export default function handler(req, res) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      error: "missing_env",
      missing: {
        TWITCH_CLIENT_ID: !clientId,
        TWITCH_REDIRECT_URI: !redirectUri
      }
    }));
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "moderator:read:followers",
  });

  const url = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;

  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}
