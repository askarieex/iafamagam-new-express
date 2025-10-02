/**
 * Debug script to test date calculation logic
 */

// Simulate the date validation logic from immutableTransactionService
function testDateValidation(transactionDate) {
    const today = new Date().toISOString().split('T')[0];

    // Convert date format if needed (DD/MM/YYYY to YYYY-MM-DD)
    let normalizedDate = transactionDate;
    if (transactionDate && transactionDate.includes('/')) {
        const parts = transactionDate.split('/');
        if (parts.length === 3) {
            // Assume DD/MM/YYYY format
            normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }

    const selectedDate = new Date(normalizedDate);
    const todayDate = new Date(today);

    // Check if date is valid after parsing
    if (isNaN(selectedDate.getTime())) {
        throw new Error('Invalid date format. Please use YYYY-MM-DD or DD/MM/YYYY format.');
    }

    const daysDifference = Math.ceil((todayDate - selectedDate) / (1000 * 60 * 60 * 24));

    console.log('=== DATE VALIDATION TEST ===');
    console.log('Today:', today);
    console.log('Transaction Date:', transactionDate);
    console.log('Normalized Date:', normalizedDate);
    console.log('Selected Date Object:', selectedDate);
    console.log('Today Date Object:', todayDate);
    console.log('Days Difference:', daysDifference);
    console.log('Is Backdated?:', daysDifference > 0);
    console.log('Within 30 days?:', daysDifference <= 30);

    return {
        allowed: daysDifference <= 30,
        daysDifference: daysDifference,
        status: daysDifference <= 30 ? 'allowed' : 'blocked'
    };
}

// Test with August 30, 2025 (assuming today is around Sept 29, 2025)
console.log('\n=== TEST 1: August 30, 2025 ===');
testDateValidation('2025-08-30');

console.log('\n=== TEST 2: August 30, 2025 (DD/MM/YYYY format) ===');
testDateValidation('30/08/2025');

console.log('\n=== TEST 3: Today\'s date ===');
const today = new Date().toISOString().split('T')[0];
testDateValidation(today);

console.log('\n=== TEST 4: Yesterday ===');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
testDateValidation(yesterday.toISOString().split('T')[0]);