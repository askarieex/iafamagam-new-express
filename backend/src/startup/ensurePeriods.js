// Ensure all accounts have current periods open on system startup
const db = require('../models');
const { ensureCurrentPeriodOpen } = require('../controllers/monthlyClosureController');

/**
 * Runs on system startup to make sure all accounts have the current period open
 */
async function ensureAllAccountsHaveCurrentPeriodOpen() {
    console.log('Starting startup check for open accounting periods...');
    
    try {
        // Get all active accounts
        const accounts = await db.Account.findAll({
            where: { is_active: true },
            attributes: ['id', 'name']
        });
        
        console.log(Found  active accounts to check for open periods);
        
        // Process each account
        for (const account of accounts) {
            console.log(Checking account:  (ID: ));
            
            try {
                const result = await ensureCurrentPeriodOpen(account.id);
                
                if (result.success && result.autoOpened) {
                    console.log( Successfully opened period for );
                } else if (result.success) {
                    console.log( Account  already has an open period);
                } else {
                    console.error( Failed to ensure open period for : );
                }
            } catch (accountError) {
                console.error(Error processing account : );
            }
        }
        
        console.log('Completed startup check for open accounting periods');
    } catch (error) {
        console.error('Failed to check/ensure open accounting periods:', error);
    }
}

module.exports = {
    ensureAllAccountsHaveCurrentPeriodOpen
};
