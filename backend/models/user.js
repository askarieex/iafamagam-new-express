'use strict';
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notNull: { msg: 'Name is required' },
                notEmpty: { msg: 'Name cannot be empty' }
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                notNull: { msg: 'Email is required' },
                isEmail: { msg: 'Please enter a valid email address' }
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notNull: { msg: 'Password is required' },
                len: {
                    args: [6, 100],
                    msg: 'Password must be at least 6 characters long'
                }
            }
        },
        role: {
            type: DataTypes.ENUM('admin', 'user'),
            allowNull: false,
            defaultValue: 'user',
            validate: {
                isIn: {
                    args: [['admin', 'user']],
                    msg: 'Role must be either admin or user'
                }
            }
        },
    }, {
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            }
        }
    });

    // Instance method to check if password matches
    User.prototype.validatePassword = async function (password) {
        return await bcrypt.compare(password, this.password);
    };

    // Class method to find user by email
    User.findByEmail = function (email) {
        return this.findOne({ where: { email } });
    };

    User.associate = function (models) {
        // Define associations here
        // Example: User.hasMany(models.Transaction, { as: 'transactions', foreignKey: 'created_by' });
    };

    return User;
}; 