import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Set page title
SettingsPage.pageTitle = 'Settings';

export default function SettingsPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [newUserForm, setNewUserForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user'
    });

    // Log user role for debugging
    useEffect(() => {
        console.log("Current user in settings:", user);
        if (user) {
            console.log("User role:", user.role);
            console.log("User permissions:", user.permissions);
        }
    }, [user]);

    // Page access permissions
    const [pagePermissions, setPagePermissions] = useState({
        dashboard: false,
        transactions: false,
        reports: false,
        accounts: false,
        settings: false
    });

    // Load users on component mount
    useEffect(() => {
        fetchUsers();
    }, []);

    // Fetch users
    const fetchUsers = async () => {
        setLoading(true);
        try {
            console.log('Fetching users from admin endpoint...');

            // Get the token from localStorage
            const token = localStorage.getItem('token');
            console.log('Using token for request:', token ? `${token.substring(0, 15)}...` : 'no token found');

            // Get the current user data
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            console.log('Current user role from localStorage:', userData.role);

            // Only attempt to fetch users if we're admin
            if (userData.role !== 'admin') {
                console.error('User is not an admin, cannot fetch users');
                toast.error('You need administrator privileges to manage users');
                setLoading(false);
                return;
            }

            // Explicitly set auth header for this request
            const config = {
                headers: {
                    'Authorization': `Bearer ${token.trim()}`
                }
            };

            // Call the API to get all users with explicit auth header
            const response = await axios.get('/api/admin/users', config);
            console.log('Users response:', response.data);
            setUsers(response.data.data || []);
        } catch (error) {
            console.error('Error loading users:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);

            // Show detailed error message
            let errorMessage = 'Failed to load users';
            if (error.response?.data?.message) {
                errorMessage += ': ' + error.response.data.message;
            } else if (error.message) {
                errorMessage += ': ' + error.message;
            }

            toast.error(errorMessage);

            // Clear users on error
            setUsers([]);

            // If it's an authorization error, don't attempt to fetch again
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.log('Authorization error, will not retry');
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewUserForm({
            ...newUserForm,
            [name]: value
        });
    };

    // Handle permissions changes
    const handlePermissionChange = (e) => {
        const { name, checked } = e.target;
        setPagePermissions({
            ...pagePermissions,
            [name]: checked
        });
    };

    // Handle edit user
    const handleEditUser = (user) => {
        setEditingUser(user);
        setPagePermissions(user.permissions || {
            dashboard: false,
            transactions: false,
            reports: false,
            accounts: false,
            settings: false
        });
    };

    // Handle delete user
    const handleDeleteUser = async (userId) => {
        if (!confirm("Are you sure you want to delete this user?")) {
            return;
        }

        try {
            // Call the API to delete the user
            await axios.delete(`/api/admin/users/${userId}`);

            toast.success('User deleted successfully');

            // Update users list by removing the deleted user
            setUsers(users.filter(user => user.id !== userId));
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user: ' + (error.response?.data?.message || error.message));
        }
    };

    // Handle form submission for creating a new user
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        if (!newUserForm.name.trim()) {
            toast.error('Name is required');
            return;
        }

        if (!newUserForm.email.trim() || !/\S+@\S+\.\S+/.test(newUserForm.email)) {
            toast.error('Valid email is required');
            return;
        }

        if (!newUserForm.password.trim() || newUserForm.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setSubmitting(true);

        try {
            // Include permissions in the data
            const userData = {
                ...newUserForm,
                permissions: pagePermissions
            };

            // Create user through API
            const response = await axios.post('/api/admin/users', userData);

            toast.success('User created successfully');

            // Add the new user from API response to the list
            setUsers([...users, response.data.data]);

            // Reset form
            setNewUserForm({
                name: '',
                email: '',
                password: '',
                role: 'user'
            });

            setPagePermissions({
                dashboard: false,
                transactions: false,
                reports: false,
                accounts: false,
                settings: false
            });
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error('Failed to create user: ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    // Handle update user permissions
    const handleUpdatePermissions = async () => {
        if (!editingUser) return;

        // Do not allow changing admin@iafa.com permissions
        if (editingUser.email === 'admin@iafa.com') {
            toast.error('Cannot modify permissions for the main administrator account');
            return;
        }

        setSubmitting(true);

        try {
            // Call the API to update permissions
            await axios.patch(`/api/admin/users/${editingUser.id}/permissions`, {
                permissions: pagePermissions
            });

            toast.success('User permissions updated successfully');

            // Update user in the local list
            setUsers(users.map(u =>
                u.id === editingUser.id
                    ? { ...u, permissions: { ...pagePermissions } }
                    : u
            ));

            // Reset state
            setEditingUser(null);
            setPagePermissions({
                dashboard: false,
                transactions: false,
                reports: false,
                accounts: false,
                settings: false
            });
        } catch (error) {
            console.error('Error updating user permissions:', error);
            toast.error('Failed to update permissions: ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ProtectedRoute requiredRole="admin" requiredPermission="settings">
            <div className="p-4 sm:p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Manage users and application settings
                </p>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mt-6">
                    {/* User Management */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 lg:col-span-2">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">User Management</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                                Loading users...
                                            </td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                                No users found
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((userItem) => (
                                            <tr key={userItem.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {userItem.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {userItem.email}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${userItem.role === 'admin'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                        }`}>
                                                        {userItem.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleEditUser(userItem)}
                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                                                    >
                                                        Edit Permissions
                                                    </button>
                                                    {/* Don't allow deleting current logged in user or the main admin */}
                                                    {userItem.id !== user.id && userItem.email !== 'admin@iafa.com' && (
                                                        <button
                                                            onClick={() => handleDeleteUser(userItem.id)}
                                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Create User or Edit Permissions */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        {editingUser ? (
                            <>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                    Edit Permissions: {editingUser.name}
                                </h2>
                                <div className="mb-6">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Select which pages this user can access:
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="dashboard"
                                            name="dashboard"
                                            checked={pagePermissions.dashboard}
                                            onChange={handlePermissionChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="dashboard" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                                            Dashboard
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="transactions"
                                            name="transactions"
                                            checked={pagePermissions.transactions}
                                            onChange={handlePermissionChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="transactions" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                                            Transactions
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="reports"
                                            name="reports"
                                            checked={pagePermissions.reports}
                                            onChange={handlePermissionChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="reports" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                                            Reports
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="accounts"
                                            name="accounts"
                                            checked={pagePermissions.accounts}
                                            onChange={handlePermissionChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="accounts" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                                            Accounts
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="settings"
                                            name="settings"
                                            checked={pagePermissions.settings}
                                            onChange={handlePermissionChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="settings" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                                            Settings
                                        </label>
                                    </div>
                                </div>
                                <div className="mt-6 flex space-x-3">
                                    <button
                                        onClick={handleUpdatePermissions}
                                        disabled={submitting}
                                        className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                    >
                                        {submitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button
                                        onClick={() => setEditingUser(null)}
                                        disabled={submitting}
                                        className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New User</h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            id="name"
                                            value={newUserForm.name}
                                            onChange={handleInputChange}
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            placeholder="Enter full name"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            id="email"
                                            value={newUserForm.email}
                                            onChange={handleInputChange}
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            placeholder="user@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            id="password"
                                            value={newUserForm.password}
                                            onChange={handleInputChange}
                                            required
                                            minLength={6}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            placeholder="Minimum 6 characters"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Role
                                        </label>
                                        <select
                                            name="role"
                                            id="role"
                                            value={newUserForm.role}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Page Access</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="dashboard"
                                                    name="dashboard"
                                                    checked={pagePermissions.dashboard}
                                                    onChange={handlePermissionChange}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="dashboard" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                                    Dashboard
                                                </label>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="transactions"
                                                    name="transactions"
                                                    checked={pagePermissions.transactions}
                                                    onChange={handlePermissionChange}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="transactions" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                                    Transactions
                                                </label>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="reports"
                                                    name="reports"
                                                    checked={pagePermissions.reports}
                                                    onChange={handlePermissionChange}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="reports" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                                    Reports
                                                </label>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="accounts"
                                                    name="accounts"
                                                    checked={pagePermissions.accounts}
                                                    onChange={handlePermissionChange}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="accounts" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                                    Accounts
                                                </label>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="settings"
                                                    name="settings"
                                                    checked={pagePermissions.settings}
                                                    onChange={handlePermissionChange}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="settings" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                                    Settings
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                        >
                                            {submitting ? 'Creating...' : 'Create User'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
} 