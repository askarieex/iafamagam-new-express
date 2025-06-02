import React from 'react';
import { useAuth } from '../hooks/useAuth';
import ProtectedRoute from '../components/auth/ProtectedRoute';

// Set page title
Dashboard.pageTitle = 'Dashboard';

export default function Dashboard() {
    const { user } = useAuth();

    return (
        <ProtectedRoute requiredPermission="dashboard">
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Welcome to IAFA Financial Management System
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Welcome Card */}
                    <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                            </div>
                            <div className="ml-5">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                    Welcome, {user?.name || 'User'}!
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    You are logged in as {user?.role || 'user'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Cards */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Total Transactions</h3>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
                        <div className="mt-4 flex items-center text-sm font-medium text-green-600">
                            <span>Ready to record</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Active Accounts</h3>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
                        <div className="mt-4 flex items-center text-sm font-medium text-blue-600">
                            <span>Set up your accounts</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Donors</h3>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
                        <div className="mt-4 flex items-center text-sm font-medium text-blue-600">
                            <span>Add your donors</span>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
} 