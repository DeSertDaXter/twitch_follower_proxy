export default async function handler(req, res) {
  try {
    const { login, id } = req.query;
    if (!login && !id) return res.status(400).json({ error: "missing login or id" });

    const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
    if (!CLIENT_ID || !CLIENT_SECRET) return res.status(500).json({ error: "server missing env vars" });

    const token = await getAppToken(CLIENT_ID, CLIENT_SECRET);

    // Falls nur login übergeben wurde: erst die ID besorgen
    let broadcasterId = id;
    if (!broadcasterId) {
      const uRes = await fetch("https://api.twitch.tv/helix/users?login=" + encodeURIComponent(login), {
        headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${token}` }
      });
      if (!uRes.ok) return res.status(500).json({ error: "users lookup failed" });
      const u = await uRes.json();
      broadcasterId = u.data?.[0]?.id;
      if (!broadcasterId) return res.status(404).json({ error: "user not found" });
    }

    // Follower-Gesamtzahl
    const fRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`, {
      headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${token}` }
    });
    if (!fRes.ok) return res.status(500).json({ error: "followers lookup failed" });
    const f = await fRes.json();
    const total = Number(f.total) || 0;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "max-age=60");
    return res.status(200).json({ broadcaster_id: broadcasterId, total });
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
}

let CACHED = { token: null, exp: 0 };
async function getAppToken(clientId, clientSecret) {
  if (CACHED.token && Date.now() < CACHED.exp) return CACHED.token;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });
  const tRes = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body });
  if (!tRes.ok) throw new Error("token fetch failed");
  const t = await tRes.json();
  CACHED.token = t.access_token;
  CACHED.exp = Date.now() + (Math.max(0, (Number(t.expires_in) || 3600) - 120) * 1000);
  return CACHED.token;
}
