// Debug the date calculation issue

console.log('🔍 Debugging Date Calculation');
console.log('============================');

const openMonths = [7, 8]; // July and August
const earliestMonth = openMonths[0]; // 7 (July)
const latestMonth = openMonths[openMonths.length - 1]; // 8 (August)

console.log('Earliest month:', earliestMonth);
console.log('Latest month:', latestMonth);

// Test the calculation step by step
console.log('\n📅 Original Date Construction (Local Time):');
console.log(`new Date(2025, ${earliestMonth - 1}, 1)`); // Should be July 1
const startDateLocal = new Date(2025, earliestMonth - 1, 1);
console.log('Start date string (local):', startDateLocal.toISOString().split('T')[0]);

console.log(`\nnew Date(2025, ${latestMonth}, 0)`); // Should be August 31  
const endDateLocal = new Date(2025, latestMonth, 0);
console.log('End date string (local):', endDateLocal.toISOString().split('T')[0]);

console.log('\n📅 Fixed Date Construction (UTC):');
console.log(`new Date(Date.UTC(2025, ${earliestMonth - 1}, 1))`); // Should be July 1
const startDate = new Date(Date.UTC(2025, earliestMonth - 1, 1));
console.log('Start date string (UTC):', startDate.toISOString().split('T')[0]);

console.log(`\nnew Date(Date.UTC(2025, ${latestMonth}, 0))`); // Should be August 31  
const endDate = new Date(Date.UTC(2025, latestMonth, 0));
console.log('End date string (UTC):', endDate.toISOString().split('T')[0]);

console.log('\n✅ Expected Results:');
console.log('Start date should be: 2025-07-01');
console.log('End date should be: 2025-08-31');