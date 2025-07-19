const { sequelize } = require('./src/models');
const fs = require('fs');
const path = require('path');

async function fixJulyBalances() {
    try {
        console.log('🔧 Fixing July 2025 opening balances...');
        
        // Read the SQL fix file
        const sqlFile = path.join(__dirname, 'fix-july-opening-balance.sql');
        const sqlCommands = fs.readFileSync(sqlFile, 'utf8');
        
        // Split by semicolons and filter out empty commands
        const commands = sqlCommands.split(';').filter(cmd => cmd.trim());
        
        // Execute each command
        for (const command of commands) {
            if (command.trim().startsWith('SELECT')) {
                // For SELECT statements, show results
                const results = await sequelize.query(command.trim(), {
                    type: sequelize.QueryTypes.SELECT
                });
                console.log('📊 Current balances:');
                console.table(results);
            } else if (command.trim()) {
                // For UPDATE statements, execute
                const [results, metadata] = await sequelize.query(command.trim());
                console.log(`✅ Updated ${metadata.rowCount || 0} rows`);
            }
        }
        
        console.log('🎉 Balance fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Error fixing balances:', error);
    } finally {
        await sequelize.close();
    }
}

// Run the fix
fixJulyBalances(); 