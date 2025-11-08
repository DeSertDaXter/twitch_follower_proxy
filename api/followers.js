export default async function handler(req, res) {
  // --- CORS erlauben + Preflight beantworten
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Client-ID");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const { login, id } = req.query;
    if (!login && !id) return res.status(400).json({ error: "missing login or id" });

    const CLIENT_ID     = process.env.TWITCH_CLIENT_ID;
    const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
    if (!CLIENT_ID) return res.status(500).json({ error: "server missing env vars: TWITCH_CLIENT_ID" });

    // --- Prefer USER token (more reliable), else fallback to APP token
    const USER_TOKEN   = process.env.TWITCH_USER_TOKEN || null; // must have scope moderator:read:followers
    const MODERATOR_ID = process.env.TWITCH_USER_ID || null;    // user id of the USER_TOKEN owner

    let token, authKind;
    if (USER_TOKEN) {
      token = USER_TOKEN;
      authKind = "user";
    } else {
      if (!CLIENT_SECRET) return res.status(500).json({ error: "server missing env vars: TWITCH_CLIENT_SECRET" });
      token = await getAppToken(CLIENT_ID, CLIENT_SECRET);
      authKind = "app";
    }

    const baseHeaders = {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${token}`,
    };

    // Falls nur login übergeben wurde: erst die ID besorgen
    let broadcasterId = id;
    if (!broadcasterId) {
      const uRes = await fetch(
        "https://api.twitch.tv/helix/users?login=" + encodeURIComponent(login),
        { headers: baseHeaders, cache: "no-store" }
      );
      if (!uRes.ok) {
        const msg = await uRes.text().catch(() => "");
        return res.status(502).json({ error: "users lookup failed", detail: msg });
      }
      const u = await uRes.json();
      broadcasterId = u.data?.[0]?.id;
      if (!broadcasterId) return res.status(404).json({ error: "user not found" });
    }

    // Follower-Gesamtzahl (channels/followers). Mit USER-Token -> moderator_id mitgeben.
    const url = new URL("https://api.twitch.tv/helix/channels/followers");
    url.searchParams.set("broadcaster_id", String(broadcasterId));
    if (authKind === "user" && MODERATOR_ID) {
      url.searchParams.set("moderator_id", String(MODERATOR_ID));
    }

    const fRes = await fetch(url.toString(), { headers: baseHeaders, cache: "no-store" });
    if (!fRes.ok) {
      const msg = await fRes.text().catch(() => "");
      // Hinweis bei 401/403: meist fehlt der Scope / falsches Token
      if (fRes.status === 401 || fRes.status === 403) {
        return res.status(403).json({
          error: "followers lookup forbidden",
          detail: msg,
          hint: "If using USER token, ensure scope 'moderator:read:followers' and pass TWITCH_USER_ID as moderator_id.",
        });
      }
      return res.status(502).json({ error: "followers lookup failed", detail: msg });
    }

    const f = await fRes.json();
    const total = Number(f.total) || 0;

    // kurze Client-Cache-Dauer zulassen
    res.setHeader("Cache-Control", "max-age=60");
    return res.status(200).json({
      broadcaster_id: broadcasterId,
      total,
      auth: authKind, // "user" oder "app" (nur Debug/Transparenz)
    });
  } catch (e) {
    return res.status(500).json({ error: "server error", detail: String(e?.message || e) });
  }
}

// --- App-Token Cache (Fallback-Pfad)
let CACHED = { token: null, exp: 0 };
async function getAppToken(clientId, clientSecret) {
  if (CACHED.token && Date.now() < CACHED.exp) return CACHED.token;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const tRes = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body });
  if (!tRes.ok) {
    const msg = await tRes.text().catch(() => "");
    throw new Error("token fetch failed: " + msg);
  }

  const t = await tRes.json();
  CACHED.token = t.access_token;
  CACHED.exp = Date.now() + (Math.max(0, (Number(t.expires_in) || 3600) - 120) * 1000);
  return CACHED.token;
}
