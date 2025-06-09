'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class AuditLog extends Model {
    static associate(models) {
      // Define associations if needed
      // For example, connect to User if user_id is provided
      if (models.User) {
        AuditLog.belongsTo(models.User, {
          foreignKey: 'user_id',
          as: 'user'
        });
      }
    }
  }

  AuditLog.init({
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    entity_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    timestamps: true,
    underscored: true
  });

  return AuditLog;
};