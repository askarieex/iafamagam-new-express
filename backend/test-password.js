const bcrypt = require('bcryptjs');

async function testPasswordHashing() {
    console.log('=== PASSWORD HASHING TEST ===');

    // 1. Create a password and hash it
    const password = '123456789';
    console.log('Original password:', password);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Hashed password:', hashedPassword);

    // 2. Try to validate the password
    const isValid = await bcrypt.compare(password, hashedPassword);
    console.log('Password validation result:', isValid);

    return isValid;
}

testPasswordHashing()
    .then(result => {
        console.log('Test completed. Password valid:', result);
    })
    .catch(err => {
        console.error('Test failed with error:', err);
    }); 