const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
require('dotenv').config();

// Create Sequelize instance
const sequelize = new Sequelize({
    dialect: process.env.DB_DIALECT || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'iafa',
    logging: false
});

// Configure Umzug
const umzug = new Umzug({
    migrations: {
        glob: ['migrations/*.js', { cwd: __dirname }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
});

// Run migrations
async function runMigrations() {
    try {
        console.log('Starting migrations...');

        // If a specific migration is specified as an argument, run only that one
        const specificMigration = process.argv[2];

        if (specificMigration) {
            console.log(`Running specific migration: ${specificMigration}`);
            await umzug.up({ to: specificMigration });
            console.log(`Migration '${specificMigration}' completed successfully.`);
        } else {
            // Run the account last_closed_date migration
            try {
                await umzug.up({ to: '20250510000005-add-last-closed-date-to-accounts.js' });
                console.log('Added last_closed_date to accounts table.');
            } catch (error) {
                console.error('Error running last_closed_date migration:', error);
            }

            // Run all pending migrations
            const pending = await umzug.pending();
            console.log(`Found ${pending.length} pending migrations.`);

            if (pending.length > 0) {
                const migrations = await umzug.up();
                console.log('All migrations executed successfully:');
                migrations.forEach(migration => console.log(`- ${migration.name}`));
            } else {
                console.log('No pending migrations to run.');
            }
        }
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    } finally {
        // Close the connection
        await sequelize.close();
    }
}

// Execute migrations
runMigrations(); 