import { saveTokens } from "../../lib/twitchAuth.js";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("Missing code");
  }

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.TWITCH_REDIRECT_URI,
  });

  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: params,
  });

  const data = await r.json();
  await saveTokens(data);

  res.send("✅ Twitch erfolgreich verbunden. Du kannst dieses Fenster schließen.");
}
