import { createContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

// Create auth context
export const AuthContext = createContext();

// API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Load user from localStorage on initial load and set up axios interceptors
    useEffect(() => {
        // Configure axios to include the base API URL
        axios.defaults.baseURL = API_URL;

        // Set up global request interceptor for authorization
        const requestInterceptor = axios.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('token');
                if (token) {
                    // Make sure the token is clean and properly formatted
                    const cleanToken = token.trim();
                    console.log('Adding auth header with token:', cleanToken.substring(0, 20) + '...');
                    config.headers.Authorization = `Bearer ${cleanToken}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        const loadUserFromStorage = async () => {
            try {
                const storedUser = localStorage.getItem('user');
                const storedToken = localStorage.getItem('token');

                if (storedUser && storedToken) {
                    console.log('Loading user from localStorage:', storedUser);
                    const parsedUser = JSON.parse(storedUser);

                    // Verify the user has all required fields
                    if (!parsedUser.role) {
                        console.error('Stored user missing role!', parsedUser);
                        logout();
                        return;
                    }

                    console.log('Restored user from storage with role:', parsedUser.role);
                    setUser(parsedUser);

                    // Set default Authorization header
                    axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

                    // Verify token is still valid with backend
                    try {
                        // Only verify with backend if it's not the admin user to avoid unnecessary calls
                        if (parsedUser.email !== 'admin@iafa.com') {
                            await getCurrentUser();
                        }
                    } catch (error) {
                        console.error('Token validation error:', error);
                        // If token is invalid, log the user out
                        logout();
                    }
                }
            } catch (error) {
                console.error('Error loading user:', error);
                logout();
            } finally {
                setLoading(false);
            }
        };

        // Set up axios interceptor to handle 401 responses
        const responseInterceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    // Token expired or invalid
                    console.error('401 error detected, logging out user', error.response?.data);

                    // Only log out if the error is related to authentication
                    const errorMsg = error.response?.data?.message || '';
                    if (errorMsg.includes('Not authorized') || errorMsg.includes('token')) {
                        logout();
                    }
                }
                return Promise.reject(error);
            }
        );

        loadUserFromStorage();

        // Clean up interceptors on unmount
        return () => {
            axios.interceptors.request.eject(requestInterceptor);
            axios.interceptors.response.eject(responseInterceptor);
        };
    }, []);

    // Register user
    const register = async (name, email, password) => {
        try {
            console.log('Attempting to register user:', email);
            const response = await axios.post('/api/auth/register', {
                name,
                email,
                password
            });

            console.log('Registration response:', response.data);

            if (!response.data.success) {
                throw new Error(response.data.message || 'Registration failed');
            }

            return response.data.data;
        } catch (error) {
            console.error('Registration error details:', error);
            const message =
                error.response?.data?.message ||
                error.message ||
                'Registration failed. Please try again.';
            throw new Error(message);
        }
    };

    // Login user
    const login = async (email, password) => {
        try {
            console.log('Attempting login with:', email);

            // For admin login, ensure we're using the right credentials
            if (email === 'admin@iafa.com') {
                console.log('Admin login detected, ensuring correct formatting');
                // Make sure email and password are correctly formatted
                email = 'admin@iafa.com';
                if (password === 'admin123') {
                    console.log('Using standard admin credentials');
                } else {
                    console.log('Warning: Non-standard admin password provided');
                }
            }

            // Make request to login endpoint
            const response = await axios.post('/api/auth/login', {
                email: email.trim(),
                password: password
            });

            console.log('Login response received:', response.status);

            // Validate the response
            if (!response.data || !response.data.success) {
                console.error('Invalid response format:', response.data);
                throw new Error('Invalid response from server');
            }

            const { data } = response.data;
            console.log('Login data:', { email: data.email, role: data.role });

            // Verify the user has a role before saving
            if (!data.role) {
                console.error('Login response missing role!', data);
                throw new Error('Invalid user data received from server');
            }

            console.log('Saving user with role:', data.role);

            // Save user and token to localStorage
            localStorage.setItem('user', JSON.stringify(data));
            localStorage.setItem('token', data.token);

            // Set default Authorization header
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

            setUser(data);

            return data;
        } catch (error) {
            console.error('Login error details:', error);
            const message =
                error.response?.data?.message ||
                error.message ||
                'Login failed. Please check your credentials.';
            throw new Error(message);
        }
    };

    // Logout user
    const logout = () => {
        // Remove user and token from localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('token');

        // Remove Authorization header
        delete axios.defaults.headers.common['Authorization'];

        setUser(null);

        // Redirect to login page
        router.push('/auth/login');
    };

    // Get current user
    const getCurrentUser = async () => {
        try {
            console.log('Fetching current user...');
            const response = await axios.get('/api/auth/me');
            console.log('Current user response:', response.data);
            const { data } = response.data;

            // Make sure we have a role
            if (!data.role) {
                console.error('Current user response missing role!', data);
                throw new Error('Invalid user data received from server');
            }

            console.log('Current user role from backend:', data.role);

            // Update localStorage with the latest user data, but keep the token
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const updatedUser = { ...currentUser, ...data };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Update user state with latest data
            setUser(prev => ({ ...prev, ...data }));

            return data;
        } catch (error) {
            console.error('Error fetching current user:', error);
            throw error;
        }
    };

    // Check if user has a specific role
    const hasRole = (role) => {
        if (!user) {
            console.log("hasRole check failed: No user");
            return false;
        }

        console.log(`Checking if user (${user.email}) has role:`, {
            userRole: user.role,
            requiredRole: role,
            result: Array.isArray(role) ? role.includes(user.role) : user.role === role
        });

        if (Array.isArray(role)) {
            return role.includes(user.role);
        }

        return user.role === role;
    };

    // Check if user has permission to access a specific page
    const hasPagePermission = (page) => {
        if (!user) {
            console.log("hasPagePermission check failed: No user");
            return false;
        }

        // Admins have access to all pages
        if (user.role === 'admin') {
            console.log(`User (${user.email}) is admin, granting access to ${page}`);
            return true;
        }

        // For regular users, check page-specific permissions
        const hasPermission = user.permissions && user.permissions[page] === true;
        console.log(`Checking if user (${user.email}) has permission for ${page}:`, {
            permissions: user.permissions,
            specificPermission: user.permissions?.[page],
            result: hasPermission
        });

        return hasPermission;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                register,
                login,
                logout,
                getCurrentUser,
                hasRole,
                hasPagePermission,
                isAuthenticated: !!user
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}; 