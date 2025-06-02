require('dotenv').config();

module.exports = {
    development: {
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'iafa_dev',
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres'
    },
    test: {
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'iafa_test',
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres'
    },
    production: {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    },
    // JWT Configuration
    jwtSecret: process.env.JWT_SECRET || 'iafa-jwt-secret-key',
    jwtExpires: process.env.JWT_EXPIRES || '1d',
    // Cookie settings
    cookieExpires: parseInt(process.env.COOKIE_EXPIRES || '1') // in days
}; 