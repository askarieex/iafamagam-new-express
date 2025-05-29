const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Donor extends Model {
        static associate(models) {
            // Define associations if needed in the future
        }
    }

    Donor.init({
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: {
                    msg: 'Donor name is required'
                }
            }
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isValidPhone(value) {
                    if (value && !/^[+]?[\d\s()-]{7,20}$/.test(value)) {
                        throw new Error('Please provide a valid phone number');
                    }
                }
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isEmail: {
                    msg: 'Please provide a valid email address'
                }
            }
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        note: {
            type: DataTypes.TEXT,
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
        modelName: 'Donor',
        tableName: 'donors',
        timestamps: true,
        underscored: true
    });

    return Donor;
}; 