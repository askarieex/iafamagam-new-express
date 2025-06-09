const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3002/api/monthly-closure/open-period';
const ACCOUNT_ID = 1; // Replace with a valid account ID from your database
let authToken = null;

// First login to get the auth token
async function login() {
  try {
    console.log('Attempting login...');
    const loginResponse = await axios.post('http://localhost:3002/api/auth/login', {
      email: 'admin@example.com', // Replace with valid credentials
      password: 'admin123'       // Replace with valid credentials
    });
    
    console.log('Login response received:', loginResponse.status);
    
    if (loginResponse.data.success) {
      console.log('Login successful');
      authToken = loginResponse.data.token;
      return true;
    } else {
      console.error('Login failed with error:', loginResponse.data.message);
      return false;
    }
  } catch (error) {
    console.error('Login error:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else if (error.request) {
      console.error('  No response received. Server might be down.');
    } else {
      console.error('  Error setting up request:', error.message);
    }
    return false;
  }
}

// Test getting the open period
async function testGetOpenPeriod() {
  try {
    console.log(`Testing get open period for account ${ACCOUNT_ID}...`);
    
    const response = await axios.get(API_URL, {
      params: { account_id: ACCOUNT_ID },
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('API Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Success! Open period retrieved successfully');
      if (response.data.message && response.data.message.includes('auto-opened')) {
        console.log('✅ Auto-open feature is working!');
      }
    } else {
      console.log('❌ Failed to get open period');
    }
  } catch (error) {
    console.error('Error testing open period:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else if (error.request) {
      console.error('  No response received');
    } else {
      console.error('  Error:', error.message);
    }
  }
}

// Execute tests
async function runTests() {
  const loggedIn = await login();
  if (loggedIn) {
    await testGetOpenPeriod();
  } else {
    console.error('Cannot proceed with tests due to login failure');
  }
}

runTests(); 