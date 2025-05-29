// API configuration
const API_CONFIG = {
    // Use environment variable or default to localhost without /api suffix
    // The component will handle adding the appropriate path
    BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002',
    // Add prefix to ensure all API calls include /api
    API_PREFIX: '/api'
};

export default API_CONFIG; 