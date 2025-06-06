const db = require('../models');

/**
 * Log an action in the audit log
 * @param {number} userId - ID of the user performing the action (null for system actions)
 * @param {string} action - Type of action (e.g., 'CLOSE_PERIOD', 'REOPEN_PERIOD')
 * @param {string} entity - Entity type affected (e.g., 'Account', 'LedgerHead')
 * @param {string|number} entityId - ID of the affected entity
 * @param {string} details - Additional details about the action
 * @param {Transaction} [transaction] - Optional Sequelize transaction
 * @returns {Promise<Object>} Created audit log entry
 */
const logAction = async (userId, action, entity, entityId, details, transaction = null) => {
  try {
    const options = transaction ? { transaction } : {};
    
    const log = await db.AuditLog.create({
      user_id: userId || null,
      action,
      entity,
      entity_id: entityId ? entityId.toString() : null,
      details
    }, options);
    
    console.log(`[AUDIT] ${action} on ${entity} ${entityId || ''}: ${details || ''}`);
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - we don't want audit logging failures to break functionality
    return null;
  }
};

module.exports = { logAction }; 