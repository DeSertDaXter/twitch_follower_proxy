export default function handler(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: process.env.TWITCH_REDIRECT_URI,
    response_type: "code",
    scope: "moderator:read:followers",
  });

  const url = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  res.redirect(url);
}
