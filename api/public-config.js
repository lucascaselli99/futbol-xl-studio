/**
 * Exposes only browser-safe public configuration values from Vercel.
 * Google OAuth Client IDs, restricted browser API keys and Project Numbers
 * are public identifiers by design; never expose a Client Secret here.
 */
module.exports = function handler(req, res) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY || '';
  const appId = process.env.GOOGLE_DRIVE_APP_ID || '';

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).send([
    `window.FXL_GOOGLE_DRIVE_CLIENT_ID = ${JSON.stringify(clientId)};`,
    `window.FXL_GOOGLE_DRIVE_API_KEY = ${JSON.stringify(apiKey)};`,
    `window.FXL_GOOGLE_DRIVE_APP_ID = ${JSON.stringify(appId)};`,
  ].join('\n'));
};
