const db = require('./src/models');
const axios = require('axios');

/**
 * Test the new year-status API endpoint
 */
async function testYearStatusAPI() {
    console.log('🧪 Testing Year Status API Endpoint');
    console.log('==================================');
    
    try {
        // Test the API endpoint directly
        console.log('📡 Testing /api/periods/year-status endpoint...');
        
        const response = await axios.get('http://localhost:3002/api/periods/year-status', {
            params: {
                account_id: 17,
                year: 2025
            },
            headers: {
                'Authorization': 'Bearer your-token' // You might need to handle auth
            }
        });
        
        console.log('✅ API Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success && response.data.data.periods) {
            const periods = response.data.data.periods;
            console.log('\n📅 Period Status Summary:');
            
            for (let month = 1; month <= 12; month++) {
                const monthName = new Date(2025, month - 1, 1).toLocaleString('default', { month: 'long' });
                const status = periods[month] ? '🔓 OPEN' : '🔒 CLOSED';
                console.log(`   ${monthName} 2025: ${status}`);
            }
            
            const openMonths = Object.keys(periods).filter(month => periods[month]).length;
            console.log(`\n📊 Summary: ${openMonths} open periods found`);
        }
        
    } catch (error) {
        if (error.response) {
            console.error('❌ API Error:', error.response.status, error.response.data);
        } else {
            console.error('❌ Network Error:', error.message);
        }
        
        // Fallback: Test directly with database
        console.log('\n🔄 Testing with direct database access...');
        
        const periods = await db.AccountingPeriod.findAll({
            where: {
                account_id: 17,
                year: 2025
            },
            order: [['month', 'ASC']]
        });
        
        console.log('📅 Direct Database Results:');
        periods.forEach(period => {
            const monthName = new Date(2025, period.month - 1, 1).toLocaleString('default', { month: 'long' });
            const status = period.status === 'open' ? '🔓 OPEN' : '🔒 CLOSED';
            console.log(`   ${monthName} 2025: ${status} (ID: ${period.id})`);
        });
        
        // Create expected API response format
        const monthStatuses = {};
        for (let month = 1; month <= 12; month++) {
            monthStatuses[month] = false;
        }
        
        periods.forEach(period => {
            monthStatuses[period.month] = period.status === 'open';
        });
        
        console.log('\n📊 Expected API Response Format:');
        console.log(JSON.stringify({
            success: true,
            data: {
                account_id: 17,
                year: 2025,
                periods: monthStatuses
            }
        }, null, 2));
    } finally {
        await db.sequelize.close();
    }
}

// Run the test
if (require.main === module) {
    testYearStatusAPI();
}

module.exports = { testYearStatusAPI };