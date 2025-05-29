const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Booklet extends Model {
    static associate(models) {
      // Define associations if needed in the future
    }
  }

  Booklet.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    booklet_no: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: 'Booklet number is required'
        }
      }
    },
    start_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Start number is required'
        },
        isInt: {
          msg: 'Start number must be an integer'
        }
      }
    },
    end_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'End number is required'
        },
        isInt: {
          msg: 'End number must be an integer'
        },
        isGreaterThanStartNo(value) {
          if (parseInt(value) <= parseInt(this.start_no)) {
            throw new Error('End number must be greater than start number');
          }
        }
      }
    },
    pages_left: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
      defaultValue: []
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Booklet',
    tableName: 'booklets',
    timestamps: true,
    underscored: true,
    freezeTableName: true
  });

  return Booklet;
}; 