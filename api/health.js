import { getAccessToken, getTokenMeta } from "../lib/twitchAuth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const wantMeta = req.query.meta === "1";

  let meta = null;

  try {
    meta = await getTokenMeta();
  } catch (e) {
    meta = {
      error: String(e?.message || e),
    };
  }

  try {
    const token = await getAccessToken();

    return res.status(200).json({
      ok: true,
      auth: "ok",
      token_loaded: !!token,
      ...(wantMeta ? { token_meta: meta } : {}),
      time: new Date().toISOString(),
    });

  } catch (e) {
    const code = e?.code || "AUTH_ERROR";

    return res.status(500).json({
      ok: false,
      auth: "failed",
      error: code,
      message: String(e?.message || e),
      detail: e?.detail,
      status_code: e?.status,
      ...(wantMeta ? { token_meta: meta } : {}),
      time: new Date().toISOString(),
    });
  }
}