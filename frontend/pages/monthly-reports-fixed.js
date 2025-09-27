/**
 * Monthly Reports Page
 *
 * Real-time monthly financial reporting system that generates reports similar
 * to the traditional format with proper opening/closing balance management.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    FaFileAlt,
    FaCalendarAlt,
    FaDollarSign,
    FaArrowRight,
    FaSearch,
    FaDownload,
    FaExclamationCircle,
    FaSpinner,
    FaCheckCircle,
    FaMoneyBillWave,
    FaUniversity,
    FaChartBar,
    FaEye,
    FaSync
} from 'react-icons/fa';
import API_CONFIG from '../config';

export default function MonthlyReports() {
    // State management
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [availableMonths, setAvailableMonths] = useState([]);

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch available months when account changes
    useEffect(() => {
        if (selectedAccountId) {
            fetchAvailableMonths();
        }
    }, [selectedAccountId]);

    /**
     * Fetch all accounts
     */
    const fetchAccounts = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/accounts`);

            if (response.data.success) {
                setAccounts(response.data.data);
                // Auto-select first account
                if (response.data.data.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(response.data.data[0].id);
                }
            } else {
                setError(response.data.message || 'Failed to fetch accounts');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
            toast.error('Error loading accounts');
        }
    };

    /**
     * Fetch available months with transaction data
     */
    const fetchAvailableMonths = async () => {
        if (!selectedAccountId) return;

        try {
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/reports/available-months/${selectedAccountId}`
            );

            if (response.data.success) {
                setAvailableMonths(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching available months:', err);
        }
    };

    /**
     * Generate monthly report
     */
    const generateMonthlyReport = async (regenerate = false) => {
        if (!selectedAccountId || !selectedYear || !selectedMonth) {
            toast.error('Please select account, year, and month');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log(`🔄 Generating report for ${selectedYear}-${selectedMonth}, Account: ${selectedAccountId}`);

            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/reports/monthly/${selectedYear}/${selectedMonth}/${selectedAccountId}`,
                {
                    params: {
                        regenerate: regenerate,
                        include_transactions: false,
                        save_results: true
                    }
                }
            );

            if (response.data.success) {
                setReportData(response.data.data);
                toast.success(response.data.message);
                console.log('✅ Report generated successfully');
            } else {
                throw new Error(response.data.message || 'Failed to generate report');
            }

        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate report';
            setError(errorMessage);
            toast.error(errorMessage);
            console.error('❌ Report generation failed:', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Format currency value
     */
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    /**
     * Get month name
     */
    const getMonthName = (year, month) => {
        return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <div className="w-full space-y-6 animate-fadeIn">
            {/* Page Header */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                    <h1 className="text-xl font-semibold text-white flex items-center">
                        <FaFileAlt className="mr-3" />
                        Monthly Financial Reports
                    </h1>
                    <p className="text-blue-100 mt-1">
                        Real-time monthly reporting with automatic balance calculations
                    </p>
                </div>

                {/* Controls Section */}
                <div className="p-6 bg-gray-50 dark:bg-secondary-700">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Account Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Account
                            </label>
                            <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-secondary-800 dark:border-secondary-600 dark:text-white"
                            >
                                <option value="">Select Account</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Year Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Year
                            </label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-secondary-800 dark:border-secondary-600 dark:text-white"
                            >
                                {Array.from({ length: 10 }, (_, i) => {
                                    const year = new Date().getFullYear() - i;
                                    return (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Month Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Month
                            </label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-secondary-800 dark:border-secondary-600 dark:text-white"
                            >
                                {Array.from({ length: 12 }, (_, i) => {
                                    const month = i + 1;
                                    const monthName = new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' });
                                    return (
                                        <option key={month} value={month}>
                                            {monthName}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Generate Button */}
                        <div className="flex flex-col justify-end">
                            <button
                                onClick={() => generateMonthlyReport()}
                                disabled={loading || !selectedAccountId}
                                className={`w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center ${
                                    loading || !selectedAccountId
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                } transition-colors duration-200`}
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="animate-spin mr-2" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <FaSearch className="mr-2" />
                                        Generate Report
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Available Months Info */}
                    {availableMonths.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-secondary-800 rounded-lg border border-blue-200 dark:border-secondary-600">
                            <div className="flex items-start">
                                <FaCalendarAlt className="text-blue-600 mt-1 mr-2" />
                                <div>
                                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                        Available Months with Data
                                    </h4>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {availableMonths.slice(0, 12).map((monthData, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    setSelectedYear(monthData.year);
                                                    setSelectedMonth(monthData.month);
                                                }}
                                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                            >
                                                {monthData.month_name}
                                                <span className="ml-1 text-blue-600">({monthData.transaction_count})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <FaExclamationCircle className="text-red-600 mr-2" />
                        <span className="text-red-800 font-medium">Error</span>
                    </div>
                    <p className="text-red-700 mt-1">{error}</p>
                </div>
            )}

            {/* Report Display */}
            {reportData && (
                <MonthlyReportDisplay
                    reportData={reportData}
                    formatCurrency={formatCurrency}
                    onRegenerateReport={() => generateMonthlyReport(true)}
                />
            )}
        </div>
    );
}

/**
 * Monthly Report Display Component
 */
function MonthlyReportDisplay({ reportData, formatCurrency, onRegenerateReport }) {
    return (
        <div className="space-y-6">
            {/* Report Header */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                <div className="bg-black text-white px-6 py-3 text-center">
                    <h2 className="text-lg font-bold">
                        FINANCIAL REPORT FOR THE MONTH OF {reportData.month_name.toUpperCase()}
                    </h2>
                    <h3 className="text-sm font-medium opacity-90">
                        GENERAL ACCOUNT
                    </h3>
                </div>

                {/* Report Summary */}
                <div className="p-6 bg-gray-50 dark:bg-secondary-700">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border border-gray-200 dark:border-secondary-600">
                            <div className="flex items-center">
                                <FaMoneyBillWave className="text-green-600 text-xl mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Credits</p>
                                    <p className="text-lg font-semibold text-green-600">
                                        {formatCurrency(reportData.totals.total_credits)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border border-gray-200 dark:border-secondary-600">
                            <div className="flex items-center">
                                <FaUniversity className="text-red-600 text-xl mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Debits</p>
                                    <p className="text-lg font-semibold text-red-600">
                                        {formatCurrency(reportData.totals.total_debits)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border border-gray-200 dark:border-secondary-600">
                            <div className="flex items-center">
                                <FaDollarSign className="text-blue-600 text-xl mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Closing Balance</p>
                                    <p className="text-lg font-semibold text-blue-600">
                                        {formatCurrency(reportData.totals.closing_balance)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border border-gray-200 dark:border-secondary-600">
                            <div className="flex items-center">
                                <FaChartBar className="text-purple-600 text-xl mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                                    <p className="text-lg font-semibold text-purple-600">
                                        {reportData.totals.transaction_count}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 mt-4">
                        <button
                            onClick={onRegenerateReport}
                            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        >
                            <FaSync className="mr-2" />
                            Regenerate
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <FaDownload className="mr-2" />
                            Print
                        </button>
                    </div>
                </div>
            </div>

            {/* Ledger Heads Report Table */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-secondary-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-secondary-600">
                                    Ledger Head
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-secondary-600">
                                    O.B
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-secondary-600">
                                    Recep. During the Month
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-secondary-600">
                                    Amount
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Balance
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-secondary-800 divide-y divide-gray-200 dark:divide-secondary-600">
                            {/* Credit Heads */}
                            {reportData.credit_heads?.map((ledger, index) => (
                                <tr key={`credit-${index}`} className="hover:bg-gray-50 dark:hover:bg-secondary-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-secondary-600">
                                        {ledger.ledger_head.display_name || ledger.ledger_head.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-secondary-600">
                                        {formatCurrency(ledger.opening_balance)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-secondary-600">
                                        {formatCurrency(ledger.total_credits)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-secondary-600">
                                        {formatCurrency(ledger.total_debits)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                                        {formatCurrency(ledger.closing_balance)}
                                    </td>
                                </tr>
                            )) || []}

                            {/* Credit Totals */}
                            {reportData.credit_heads?.length > 0 && (
                                <tr className="bg-black text-white font-bold">
                                    <td className="px-6 py-3 text-sm font-bold border-r border-gray-600">
                                        Total (T1)
                                    </td>
                                    <td className="px-6 py-3 text-sm text-center border-r border-gray-600">
                                        {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.opening_balance, 0))}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-center border-r border-gray-600">
                                        {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.total_credits, 0))}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-center border-r border-gray-600">
                                        {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.total_debits, 0))}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-center">
                                        {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.closing_balance, 0))}
                                    </td>
                                </tr>
                            )}

                            {/* Debit Heads */}
                            {reportData.debit_heads?.map((ledger, index) => (
                                <tr key={`debit-${index}`} className="hover:bg-gray-50 dark:hover:bg-secondary-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-secondary-600">
                                        {ledger.ledger_head.display_name || ledger.ledger_head.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-secondary-600">
                                        {formatCurrency(ledger.opening_balance)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-secondary-600">
                                        {formatCurrency(ledger.total_credits)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-secondary-600">
                                        {formatCurrency(ledger.total_debits)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                                        {formatCurrency(ledger.closing_balance)}
                                    </td>
                                </tr>
                            )) || []}
                        </tbody>
                    </table>
                </div>

                {/* Report Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-secondary-700 border-t border-gray-200 dark:border-secondary-600">
                    <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                        <div>
                            Generated on: {new Date(reportData.generated_at).toLocaleString()}
                        </div>
                        <div className="flex items-center">
                            <FaCheckCircle className="text-green-500 mr-1" />
                            {reportData.is_saved_report ? 'Saved Report' : 'Real-time Calculation'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Set custom page title
MonthlyReports.pageTitle = "Monthly Reports";