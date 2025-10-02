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
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [availableMonths, setAvailableMonths] = useState([]);
    const [isCurrentMonth, setIsCurrentMonth] = useState(true);
    const [snapshotGenerating, setSnapshotGenerating] = useState(false);

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
        fetchAvailableMonths();
    }, []);

    // Check if selected month is current month
    useEffect(() => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const isCurrent = selectedYear === currentYear && selectedMonth === currentMonth;
        setIsCurrentMonth(isCurrent);
    }, [selectedYear, selectedMonth]);

    /**
     * Fetch all accounts
     */
    const fetchAccounts = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/accounts`);

            if (response.data.success) {
                setAccounts(response.data.data);
                // No need to auto-select account since we use combined reports
            } else {
                setError(response.data.message || 'Failed to fetch accounts');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
            toast.error('Error loading accounts');
        }
    };

    /**
     * Fetch available months with transaction data (all accounts combined)
     */
    const fetchAvailableMonths = async () => {
        try {
            // Use account ID 1 as default to get all available months
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/transactions/available-months/1`
            );

            if (response.data.success) {
                setAvailableMonths(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching available months:', err);
        }
    };

    /**
     * Generate monthly report (all accounts combined)
     */
    const generateMonthlyReport = async (regenerate = false) => {
        if (!selectedYear || !selectedMonth) {
            toast.error('Please select year and month');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log(`🔄 Generating combined report for ${selectedYear}-${selectedMonth}`);

            // Use account ID 1 as default - the backend will combine all accounts
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/reports/monthly/${selectedYear}/${selectedMonth}/1`,
                {
                    params: {
                        regenerate: regenerate,
                        include_transactions: false,
                        save_results: true,
                        all_accounts: true,
                        _t: Date.now() // Cache buster to prevent stale data
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
     * Regenerate snapshots for historical months
     */
    const regenerateSnapshots = async () => {
        if (isCurrentMonth) {
            toast.warning('Cannot regenerate snapshots for current month');
            return;
        }

        setSnapshotGenerating(true);

        try {
            console.log(`🔄 Regenerating snapshots for ${selectedYear}-${selectedMonth}`);

            const response = await axios.post(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/reports/regenerate-snapshots/1/${selectedYear}/${selectedMonth}`
            );

            if (response.data.success) {
                toast.success('Snapshots regenerated successfully');
                // Regenerate the report after snapshots are updated
                generateMonthlyReport(true);
            } else {
                throw new Error(response.data.message || 'Failed to regenerate snapshots');
            }

        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to regenerate snapshots';
            toast.error(errorMessage);
            console.error('❌ Snapshot regeneration failed:', err);
        } finally {
            setSnapshotGenerating(false);
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Note: No account selection - shows combined report for all accounts */}

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
                        <div className="flex flex-col justify-end space-y-2">
                            <button
                                onClick={() => generateMonthlyReport()}
                                disabled={loading}
                                className={`w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center ${
                                    loading
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

                            {/* Report Type Indicator */}
                            <div className={`text-xs text-center px-2 py-1 rounded ${
                                isCurrentMonth
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            }`}>
                                {isCurrentMonth ? '📊 Real-time Report' : '📂 Historical Report'}
                            </div>

                            {/* Regenerate Snapshots Button - Only for historical months */}
                            {!isCurrentMonth && (
                                <button
                                    onClick={regenerateSnapshots}
                                    disabled={snapshotGenerating || loading}
                                    className={`w-full px-3 py-1.5 text-xs rounded-lg font-medium flex items-center justify-center ${
                                        snapshotGenerating || loading
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : 'bg-yellow-500 text-white hover:bg-yellow-600'
                                    } transition-colors duration-200`}
                                >
                                    {snapshotGenerating ? (
                                        <>
                                            <FaSpinner className="animate-spin mr-1" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <FaSync className="mr-1" />
                                            Update Snapshots
                                        </>
                                    )}
                                </button>
                            )}
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
                    isCurrentMonth={isCurrentMonth}
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                />
            )}
        </div>
    );
}

/**
 * Monthly Report Display Component
 */
function MonthlyReportDisplay({ reportData, formatCurrency, onRegenerateReport, isCurrentMonth, selectedYear, selectedMonth }) {
    return (
        <div className="space-y-6">
            {/* Report Header */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                <div className="bg-black text-white px-6 py-3 text-center">
                    <h2 className="text-lg font-bold">
                        FINANCIAL REPORT FOR THE MONTH OF {reportData.month_name.toUpperCase()}
                    </h2>
                    <h3 className="text-sm font-medium opacity-90">
                        {reportData.account_display_name || 'ALL ACCOUNTS COMBINED'}
                    </h3>
                </div>

                {/* Report Metadata */}
                <div className={`px-6 py-2 text-center text-sm ${
                    isCurrentMonth
                        ? 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-orange-50 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                }`}>
                    {isCurrentMonth
                        ? '📊 Real-time Report (Current Month)'
                        : '📂 Historical Report (Snapshot-based)'
                    }
                    {reportData.report_metadata?.generation_time && (
                        <span className="ml-4 opacity-75">
                            Generated: {new Date(reportData.report_metadata.generation_time).toLocaleString()}
                        </span>
                    )}
                    {reportData.report_metadata?.is_historical && (
                        <span className="ml-4 opacity-75">
                            • Using {reportData.report_metadata.report_type || 'snapshot'} data
                        </span>
                    )}
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

            {/* Traditional Balance Sheet Layout - Account-wise Format */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">

                {/* Account-wise Tables */}
                {reportData.account_groups?.map((accountGroup, groupIndex) => (
                    <div key={`account-${groupIndex}`} className="mb-4">
                        {/* Account Header */}
                        <div className="bg-blue-600 text-white px-4 py-3 text-center font-bold text-lg">
                            {accountGroup.account.name.toUpperCase()}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="bg-gray-100 dark:bg-secondary-700">
                                    <tr>
                                        {/* Credit Side Headers */}
                                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            Ledger Head
                                        </th>
                                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            O.B
                                        </th>
                                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            Recep. During the Month
                                        </th>
                                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            G. Total
                                        </th>
                                        {/* Debit Side Headers */}
                                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            Ledger Head
                                        </th>
                                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            Amount
                                        </th>
                                        {/* Balance and Cash columns for credit side */}
                                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            Balance
                                        </th>
                                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            Cash in Bank
                                        </th>
                                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300">
                                            Cash in Hand
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-secondary-800">
                                    {/* Get max rows needed for this account */}
                                    {(() => {
                                        const creditHeads = accountGroup.credit_heads || [];
                                        const debitHeads = accountGroup.debit_heads || [];
                                        const maxRows = Math.max(creditHeads.length, debitHeads.length);
                                        const rows = [];

                                        for (let i = 0; i < maxRows; i++) {
                                            const creditHead = creditHeads[i];
                                            const debitHead = debitHeads[i];

                                            rows.push(
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-secondary-700">
                                                    {/* Credit Side: Ledger Head, O.B, Receipts, G.Total */}
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white border border-gray-300">
                                                        {creditHead?.ledger_head.name || ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-center border border-gray-300">
                                                        {creditHead ? formatCurrency(creditHead.opening_balance) : ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-center border border-gray-300">
                                                        {creditHead ? formatCurrency(creditHead.total_credits) : ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-center border border-gray-300">
                                                        {creditHead ? formatCurrency(creditHead.opening_balance + creditHead.total_credits) : ''}
                                                    </td>
                                                    {/* Debit Side: Ledger Head, Amount */}
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white border border-gray-300">
                                                        {debitHead?.ledger_head.name || ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-center border border-gray-300">
                                                        {debitHead ? formatCurrency(debitHead.closing_balance) : ''}
                                                    </td>
                                                    {/* Balance and Cash columns - only for credit heads */}
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-center border border-gray-300">
                                                        {creditHead ? formatCurrency(creditHead.closing_balance) : ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-center border border-gray-300">
                                                        {creditHead ? formatCurrency(creditHead.bank_amount || 0) : ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-center border border-gray-300">
                                                        {creditHead ? formatCurrency(creditHead.cash_amount || 0) : ''}
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return rows;
                                    })()}

                                    {/* Account Total Row */}
                                    <tr className="bg-gray-200 dark:bg-secondary-600 font-bold">
                                        <td className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-white border border-gray-300">
                                            {accountGroup.account.name} Total Income
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-gray-300">
                                            {formatCurrency(accountGroup.credit_heads.reduce((sum, l) => sum + l.opening_balance, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-gray-300">
                                            {formatCurrency(accountGroup.credit_heads.reduce((sum, l) => sum + l.total_credits, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-gray-300">
                                            {formatCurrency(accountGroup.credit_heads.reduce((sum, l) => sum + l.opening_balance + l.total_credits, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-white border border-gray-300">
                                            {accountGroup.account.name} Total Expenses
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-gray-300">
                                            {formatCurrency(accountGroup.debit_heads.reduce((sum, l) => sum + l.closing_balance, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-gray-300">
                                            {formatCurrency(accountGroup.credit_heads.reduce((sum, l) => sum + l.closing_balance, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-gray-300">
                                            {formatCurrency(accountGroup.credit_heads.reduce((sum, l) => sum + (l.bank_amount || 0), 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-gray-300">
                                            {formatCurrency(accountGroup.credit_heads.reduce((sum, l) => sum + (l.cash_amount || 0), 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                {/* Grand Totals Section */}
                {reportData.credit_heads?.length > 0 && (
                    <div className="bg-black text-white">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <tbody>
                                    <tr className="font-bold">
                                        <td className="px-3 py-2 text-sm font-bold border border-white">
                                            Grand Total Income (All Accounts)
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-white">
                                            {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.opening_balance, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-white">
                                            {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.total_credits, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-white">
                                            {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.opening_balance + l.total_credits, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm font-bold border border-white">
                                            Grand Total Expenses (All Accounts)
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-white">
                                            {reportData.debit_heads ? formatCurrency(reportData.debit_heads.reduce((sum, l) => sum + l.closing_balance, 0)) : '₹0.00'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-white">
                                            {formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + l.closing_balance, 0))}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-white">
                                            {reportData.credit_heads ? formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + (l.bank_amount || 0), 0)) : '₹0.00'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center border border-white">
                                            {reportData.credit_heads ? formatCurrency(reportData.credit_heads.reduce((sum, l) => sum + (l.cash_amount || 0), 0)) : '₹0.00'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Grand Total Summary */}
                <div className="bg-black text-white px-4 py-3 text-center">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="text-sm font-bold">
                            Total Income: {formatCurrency(reportData.totals.total_credits)}
                        </div>
                        <div className="text-sm font-bold">
                            Total Expenses: {formatCurrency(reportData.totals.total_debits)}
                        </div>
                    </div>
                    <div className="mt-2 text-lg font-bold">
                        Net Balance: {formatCurrency(reportData.totals.closing_balance)}
                    </div>
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