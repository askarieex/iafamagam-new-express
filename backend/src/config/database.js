const { Sequelize } = require('sequelize');
require('dotenv').config();

// Get config based on environment
const env = process.env.NODE_ENV || 'development';
const config = require('../../config/config.json')[env];

// Create Sequelize instance
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        dialect: config.dialect,
        logging: config.logging !== undefined ? config.logging : console.log,
        define: {
            underscored: true,
            freezeTableName: true
        }
    }
);

// Test connection
sequelize
    .authenticate()
    .then(() => {
        console.log('Database connection established successfully.');
    })
    .catch((err) => {
        console.error('Unable to connect to the database:', err);
    });

module.exports = sequelize;