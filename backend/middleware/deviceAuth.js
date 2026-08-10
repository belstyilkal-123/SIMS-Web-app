const crypto = require('crypto');

// Authenticates hardware requests with a secret kept outside source control.
module.exports = (req, res, next) => {
  const configuredKey = process.env.DEVICE_API_KEY;
  const receivedKey = req.get('x-device-api-key');

  if (!configuredKey) {
    console.error('DEVICE_API_KEY is not configured; rejecting device request.');
    return res.status(503).json({ error: 'Device authentication is not configured.' });
  }
  if (!receivedKey || receivedKey.length !== configuredKey.length) {
    return res.status(401).json({ error: 'Invalid device credentials.' });
  }
  if (!crypto.timingSafeEqual(Buffer.from(receivedKey), Buffer.from(configuredKey))) {
    return res.status(401).json({ error: 'Invalid device credentials.' });
  }
  next();
};
