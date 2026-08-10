const AuditLog = require('../models/AuditLog');

/**
 * Middleware to log mutating API requests
 */
const auditLogger = async (req, res, next) => {
  // We only want to log mutations, not reads
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Intercept response finish
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          // Identify resource by route path (e.g., /api/farms -> Farm)
          const resourceName = req.originalUrl.split('/')[2] || 'System';
          
          let actionName = 'UPDATE';
          if (req.method === 'POST') actionName = 'CREATE';
          if (req.method === 'DELETE') actionName = 'DELETE';

          // Special case for manual pump override
          if (req.originalUrl.includes('irrigation/manual')) {
            actionName = 'MANUAL_OVERRIDE';
          }

          const audit = new AuditLog({
            userId: req.user._id,
            action: actionName,
            resource: resourceName.charAt(0).toUpperCase() + resourceName.slice(1),
            resourceId: req.params.id || req.body.deviceId || req.body.farmId || null,
            details: `Method: ${req.method} | URL: ${req.originalUrl}`,
            ipAddress: req.ip || req.connection.remoteAddress
          });
          
          await audit.save();
        } catch (error) {
          console.error('Audit Log Error:', error);
        }
      }
    });
  }
  next();
};

module.exports = auditLogger;
