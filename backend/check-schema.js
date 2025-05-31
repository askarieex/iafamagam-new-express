const { Sequelize } = require('sequelize');

// Create a connection to your database
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/iafa_db', {
    logging: false
});

async function checkSchema() {
    try {
        // Test the connection
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Get cheques table schema
        const [chequesResult] = await sequelize.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cheques'"
        );
        console.log('Cheques table columns:');
        console.table(chequesResult);

        // Get transactions table schema
        const [transactionsResult] = await sequelize.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'"
        );
        console.log('Transactions table columns:');
        console.table(transactionsResult);

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

checkSchema(); 