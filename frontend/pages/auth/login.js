import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function Login() {
    const router = useRouter();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Pre-fill with admin credentials for easy login
    const fillAdminCredentials = () => {
        setFormData({
            email: 'admin@iafa.com',
            password: 'admin123'
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);

        try {
            console.log('Attempting login with:', formData.email);

            // Special handling for admin login
            if (formData.email === 'admin@iafa.com' && formData.password === 'admin123') {
                console.log('Admin credentials detected, ensuring admin status');
            }

            const userData = await login(formData.email, formData.password);

            console.log('Login successful:', {
                name: userData.name,
                email: userData.email,
                role: userData.role
            });

            toast.success('Login successful');

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (error) {
            console.error('Login error:', error);
            toast.error(error.message || 'Failed to login. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-100 dark:bg-gray-900">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                        IAFA
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    IAFA Software
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    Financial Management System
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <div className="mb-5 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Default Admin Credentials</h3>
                                <div className="mt-2 text-sm text-blue-700 dark:text-blue-200">
                                    <p>Email: admin@iafa.com</p>
                                    <p>Password: admin123</p>
                                </div>
                                <div className="mt-3 flex space-x-3">
                                    <button
                                        type="button"
                                        onClick={fillAdminCredentials}
                                        className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                                    >
                                        Use default credentials
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                setLoading(true);
                                                await login('admin@iafa.com', 'admin123');
                                                toast.success('Admin login successful');
                                                router.push('/dashboard');
                                            } catch (error) {
                                                console.error('Quick admin login error:', error);
                                                toast.error('Admin login failed: ' + error.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="text-sm font-medium text-green-600 hover:text-green-500 dark:text-green-400"
                                    >
                                        Login as Admin
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={`block w-full appearance-none rounded-md border px-3 py-2 shadow-sm focus:outline-none sm:text-sm
                    ${errors.email
                                            ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
                                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                                        }`}
                                />
                                {errors.email && (
                                    <p className="mt-2 text-sm text-red-600">{errors.email}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`block w-full appearance-none rounded-md border px-3 py-2 shadow-sm focus:outline-none sm:text-sm
                    ${errors.password
                                            ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
                                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                                        }`}
                                />
                                {errors.password && (
                                    <p className="mt-2 text-sm text-red-600">{errors.password}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Remember me
                                </label>
                            </div>

                            <div className="text-sm">
                                <a href="#" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                                    Forgot password?
                                </a>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    Private Software
                                </span>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
                            This is a private financial management system. Only authorized users may access this software.
                        </p>
                        <div className="mt-4 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Don't have an account?{' '}
                                <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </div>

                    <div className="text-center mt-4">
                        <a
                            href="/auth/register"
                            className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800 mr-4"
                        >
                            Register
                        </a>
                        <a
                            href="/auth/reset-password"
                            className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800 mr-4"
                        >
                            Reset Password
                        </a>
                        <a
                            href="/auth/debug-tools"
                            className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                        >
                            Debug Tools
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
} 