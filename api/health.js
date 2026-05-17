import { getAccessToken, getTokenMeta } from "../lib/twitchAuth.js";

export default async function handler(req, res) {
  // CORS optional
  res.setHeader("Access-Control-Allow-Origin", "*");

  const meta = await getTokenMeta();

  // Optional: nur Metadaten zeigen, wenn ?meta=1
  const wantMeta = req.query.meta === "1";

  // Test: können wir ein Access Token bekommen (inkl. Refresh falls nötig)?
  try {
    await getAccessToken();
    return res.status(200).json({
      ok: true,
      auth: "ok",
      ...(wantMeta ? { token_meta: meta } : {}),
    });
  } catch (e) {
    const code = e?.code || "AUTH_ERROR";
    const status = (code === "NO_TOKENS" || code === "NO_REFRESH_TOKEN" || code === "REFRESH_FAILED") ? 401 : 500;

    return res.status(status).json({
      ok: false,
      auth: "failed",
      error: code,
      message: String(e?.message || e),
      hint: "Run /api/auth/login to re-authorize.",
      ...(wantMeta ? { token_meta: meta } : {}),
      detail: e?.detail,
      status_code: e?.status,
    });
  }
}
