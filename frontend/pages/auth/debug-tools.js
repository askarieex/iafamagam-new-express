import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import AuthLayout from '../../components/auth/AuthLayout';
import { toast } from 'react-hot-toast';

const DebugTools = () => {
    const [users, setUsers] = useState([]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState('');

    useEffect(() => {
        fetchAllUsers();
    }, []);

    const fetchAllUsers = async () => {
        try {
            const response = await axios.get(`${API_URL}/users/debug`);
            if (response.data.success) {
                setUsers(response.data.data || []);
                setDebugInfo(prev => prev + `\nFetched ${response.data.data.length} users`);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setDebugInfo(prev => prev + `\nError fetching users: ${error.message}`);
        }
    };

    const resetPassword = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Email and password are required');
            return;
        }

        try {
            setLoading(true);
            setDebugInfo(prev => prev + `\nAttempting to reset password for ${email}...`);

            const response = await axios.post(`${API_URL}/auth/public-reset`, {
                email,
                newPassword: password
            });

            if (response.data.success) {
                toast.success('Password reset successful!');
                setDebugInfo(prev => prev + `\nPassword reset successful for ${email}`);
                fetchAllUsers();
            } else {
                toast.error(response.data.message || 'Password reset failed');
                setDebugInfo(prev => prev + `\nPassword reset failed: ${response.data.message}`);
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            toast.error(error.response?.data?.message || 'Failed to reset password');
            setDebugInfo(prev => prev + `\nError: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const testLogin = async (testEmail, testPassword) => {
        try {
            setDebugInfo(prev => prev + `\nTesting login for ${testEmail}...`);

            const response = await axios.post(`${API_URL}/auth/login`, {
                email: testEmail,
                password: testPassword
            });

            if (response.data.success) {
                toast.success(`Test login successful for ${testEmail}`);
                setDebugInfo(prev => prev + `\nTest login successful for ${testEmail}`);
            }
        } catch (error) {
            console.error('Test login failed:', error);
            toast.error(`Test login failed: ${error.response?.data?.message || error.message}`);
            setDebugInfo(prev => prev + `\nTest login failed: ${error.response?.data?.message || error.message}`);
        }
    };

    return (
        <AuthLayout title="Debug Tools">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Authentication Debug Tools</h1>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Reset User Password</h2>
                    <form onSubmit={resetPassword} className="flex flex-col space-y-4">
                        <div>
                            <label className="block text-gray-700 text-sm font-bold mb-2">Email Address</label>
                            <input
                                type="email"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-700 text-sm font-bold mb-2">New Password</label>
                            <input
                                type="text"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : 'Reset Password'}
                        </button>
                    </form>
                </div>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Registered Users</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200">
                            <thead>
                                <tr>
                                    <th className="py-2 px-4 border-b text-left">ID</th>
                                    <th className="py-2 px-4 border-b text-left">Name</th>
                                    <th className="py-2 px-4 border-b text-left">Email</th>
                                    <th className="py-2 px-4 border-b text-left">Role</th>
                                    <th className="py-2 px-4 border-b text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? (
                                    users.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="py-2 px-4 border-b">{user.id}</td>
                                            <td className="py-2 px-4 border-b">{user.name}</td>
                                            <td className="py-2 px-4 border-b">{user.email}</td>
                                            <td className="py-2 px-4 border-b">{user.role}</td>
                                            <td className="py-2 px-4 border-b">
                                                <button
                                                    onClick={() => {
                                                        setEmail(user.email);
                                                        setPassword('password123');
                                                    }}
                                                    className="text-blue-500 hover:text-blue-700 mr-2"
                                                >
                                                    Use
                                                </button>
                                                <button
                                                    onClick={() => testLogin(user.email, 'password123')}
                                                    className="text-green-500 hover:text-green-700"
                                                >
                                                    Test Login
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="py-4 text-center text-gray-500">No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-4">Debug Log</h2>
                    <div className="bg-gray-100 p-4 rounded h-48 overflow-y-auto font-mono text-sm">
                        {debugInfo || 'No debug information available'}
                    </div>
                </div>

                <div className="text-center mt-6">
                    <a
                        href="/auth/login"
                        className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                    >
                        Back to Login
                    </a>
                </div>
            </div>
        </AuthLayout>
    );
};

export default DebugTools; 