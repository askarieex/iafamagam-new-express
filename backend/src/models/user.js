'use strict';
const bcrypt = require('bcryptjs');

module.exports = function (sequelize, DataTypes) {
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
        permissions: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {
                dashboard: true,
                transactions: true,
                reports: true,
                accounts: false,
                settings: false
            }
        }
    }, {
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    console.log('Hashing password for new user:', user.email);
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                    console.log('Password hashed successfully for new user');
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    console.log('Hashing updated password for user:', user.email);
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                    console.log('Password updated and hashed successfully');
                }
            }
        }
    });

    // Instance method to check if password matches
    User.prototype.validatePassword = async function (password) {
        try {
            console.log('Validating password for user:', this.email);
            // Debug info
            console.log('Stored hash length:', this.password.length);
            console.log('Input password length:', password.length);
            
            const isValid = await bcrypt.compare(password, this.password);
            console.log('Password validation result:', isValid ? 'VALID' : 'INVALID');
            return isValid;
        } catch (error) {
            console.error('Error validating password:', error);
            return false;
        }
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
} 