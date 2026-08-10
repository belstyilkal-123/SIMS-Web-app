const errorMessages = {
  en: { serverError: 'An internal server error occurred.' },
  am: { serverError: 'የውስጥ የሰርቨር ስህተት ተከስቷል።' }
};

module.exports = (err, req, res, next) => {
  console.error('[Error]', err);

  const status = err.status || 500;

  // Determine language from request (set by authMiddleware, or from header)
  const lang = req.lang || (req.headers['accept-language'] || '').startsWith('am') ? 'am' : 'en';
  const m = errorMessages[lang] || errorMessages.en;

  const payload = {
    error:    err.message || m.serverError,
    error_en: err.message || errorMessages.en.serverError
  };
  if (err.details) payload.details = err.details;

  res.status(status).json(payload);
};
