'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    entity: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    entity_id: {
      type: DataTypes.STRING(50)
    },
    details: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'audit_logs',
    underscored: true
  });

  AuditLog.associate = function(models) {
    // associations can be defined here
    if (models.User) {
      AuditLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  };

  return AuditLog;
};