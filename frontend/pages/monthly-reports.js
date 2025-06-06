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
    FaLock,
    FaLockOpen
} from 'react-icons/fa';
import API_CONFIG from '../config';

export default function MonthlyReports() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [monthlyBalances, setMonthlyBalances] = useState([]);
    const [periodStatus, setPeriodStatus] = useState({
        isOpen: true,
        lastClosedDate: null
    });
    const [totals, setTotals] = useState({
        openingBalance: 0,
        receipts: 0,
        payments: 0,
        closingBalance: 0,
        cashInHand: 0,
        cashInBank: 0
    });

    // Fetch accounts on page load
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch monthly balances when selection changes
    useEffect(() => {
        if (selectedAccountId && selectedYear && selectedMonth) {
            fetchMonthlyBalances();
            checkPeriodStatus();
        }
    }, [selectedAccountId, selectedYear, selectedMonth]);

    // Fetch all accounts
    const fetchAccounts = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/accounts`);

            if (response.data.success) {
                setAccounts(response.data.data);
                // Select the first account by default if available
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

    // Check if the selected period is open or closed
    const checkPeriodStatus = async () => {
        try {
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/status`
            );

            if (response.data.success) {
                const accounts = response.data.data;
                const selectedAccount = accounts.find(account => account.id === parseInt(selectedAccountId));

                if (selectedAccount && selectedAccount.last_closed_date) {
                    const lastClosedDate = new Date(selectedAccount.last_closed_date);
                    const selectedDate = new Date(selectedYear, selectedMonth - 1, 1); // First day of selected month

                    // If the last closed date is after or equal to the last day of the selected month, 
                    // then the period is closed
                    const lastDayOfSelectedMonth = new Date(selectedYear, selectedMonth, 0);
                    const isOpen = lastClosedDate < lastDayOfSelectedMonth;

                    setPeriodStatus({
                        isOpen,
                        lastClosedDate: selectedAccount.last_closed_date
                    });
                } else {
                    // If no closed date, period is open
                    setPeriodStatus({
                        isOpen: true,
                        lastClosedDate: null
                    });
                }
            }
        } catch (err) {
            console.error('Error checking period status:', err);
            // Default to open if we can't determine
            setPeriodStatus({
                isOpen: true,
                lastClosedDate: null
            });
        }
    };

    // Fetch monthly balances for the selected account, year and month
    const fetchMonthlyBalances = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-ledger-balances`,
                {
                    params: {
                        account_id: selectedAccountId,
                        month: selectedMonth,
                        year: selectedYear
                    }
                }
            );

            if (response.data.success) {
                const balances = response.data.data;
                setMonthlyBalances(balances);

                // Calculate totals
                const calculatedTotals = balances.reduce(
                    (acc, balance) => {
                        return {
                            openingBalance: acc.openingBalance + parseFloat(balance.opening_balance || 0),
                            receipts: acc.receipts + parseFloat(balance.receipts || 0),
                            payments: acc.payments + parseFloat(balance.payments || 0),
                            closingBalance: acc.closingBalance + parseFloat(balance.closing_balance || 0),
                            cashInHand: acc.cashInHand + parseFloat(balance.cash_in_hand || 0),
                            cashInBank: acc.cashInBank + parseFloat(balance.cash_in_bank || 0)
                        };
                    },
                    { openingBalance: 0, receipts: 0, payments: 0, closingBalance: 0, cashInHand: 0, cashInBank: 0 }
                );

                setTotals(calculatedTotals);
            } else {
                setError(response.data.message || 'Failed to fetch monthly balances');
                setMonthlyBalances([]);
                setTotals({ openingBalance: 0, receipts: 0, payments: 0, closingBalance: 0, cashInHand: 0, cashInBank: 0 });
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
            setMonthlyBalances([]);
            setTotals({ openingBalance: 0, receipts: 0, payments: 0, closingBalance: 0, cashInHand: 0, cashInBank: 0 });
        } finally {
            setLoading(false);
        }
    };

    // Handle export to CSV
    const exportToCsv = () => {
        if (monthlyBalances.length === 0) {
            toast.warning('No data to export');
            return;
        }

        // Build CSV content
        const headers = [
            'Ledger Head',
            'Opening Balance',
            'Receipts',
            'Payments',
            'Closing Balance',
            'Cash In Hand',
            'Cash In Bank'
        ];

        const rows = monthlyBalances.map(balance => [
            balance.ledgerHead?.name || 'Unknown',
            balance.opening_balance,
            balance.receipts,
            balance.payments,
            balance.closing_balance,
            balance.cash_in_hand,
            balance.cash_in_bank
        ]);

        // Add totals row
        rows.push([
            'TOTALS',
            totals.openingBalance,
            totals.receipts,
            totals.payments,
            totals.closingBalance,
            totals.cashInHand,
            totals.cashInBank
        ]);

        // Convert to CSV string
        let csvContent = headers.join(',') + '\n';
        csvContent += rows.map(row => row.join(',')).join('\n');

        // Trigger download
        const selectedAccount = accounts.find(account => account.id === parseInt(selectedAccountId));
        const accountName = selectedAccount ? selectedAccount.name : 'account';
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const filename = `${accountName}_${monthNames[selectedMonth - 1]}_${selectedYear}_monthly_report.csv`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

        // Create download link and click it
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Format currency values
    const formatCurrency = (amount) => {
        const value = parseFloat(amount);
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(value);
    };

    // Get month name
    const getMonthName = (month) => {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return monthNames[month - 1];
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="page-content-wrapper">
            <div className="w-full space-y-5 animate-fadeIn">
                <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-secondary-700">
                        <div className="flex items-center gap-2 mb-3 sm:mb-0">
                            <FaFileAlt className="text-indigo-600 text-xl" />
                            <h2 className="text-lg sm:text-xl font-semibold text-secondary-900 dark:text-white">
                                Monthly Ledger Reports
                            </h2>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 p-5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Account selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Account
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <select
                                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                >
                                    <option value="">Select Account</option>
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Year selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Year
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <select
                                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                >
                                    {Array.from({ length: 10 }, (_, i) => {
                                        const year = new Date().getFullYear() - 5 + i;
                                        return (
                                            <option key={year} value={year}>
                                                {year}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Month selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Month
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <select
                                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            {getMonthName(i + 1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Search button */}
                        <div className="flex items-end">
                            <button
                                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md flex items-center justify-center hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                onClick={fetchMonthlyBalances}
                                disabled={!selectedAccountId}
                            >
                                <FaSearch className="mr-2" /> Generate Report
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg flex items-center">
                        <FaExclamationCircle className="text-red-500 mr-3 flex-shrink-0" />
                        <div>
                            <h3 className="text-sm font-medium text-red-800">Error</h3>
                            <div className="mt-1 text-sm text-red-700">{error}</div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-md">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                        <p className="mt-4 text-indigo-600 font-medium">Loading data...</p>
                    </div>
                ) : (
                    <>
                        {monthlyBalances.length > 0 ? (
                            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                                <div className="px-4 py-4 bg-gray-50 dark:bg-secondary-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                    <div className="flex items-center">
                                        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                                            <FaCalendarAlt className="mr-2" />
                                            Monthly Report - {getMonthName(selectedMonth)} {selectedYear}
                                        </h2>

                                        {/* Period status indicator */}
                                        <div className="ml-4">
                                            {periodStatus.isOpen ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    <FaLockOpen className="mr-1" />
                                                    Period Open
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    <FaLock className="mr-1" />
                                                    Period Closed
                                                </span>
                                            )}
                                        </div>

                                        {periodStatus.lastClosedDate && (
                                            <span className="ml-2 text-xs text-gray-500">
                                                Last closed: {formatDate(periodStatus.lastClosedDate)}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className="flex-1 sm:flex-none px-3 py-2 text-xs bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium flex items-center justify-center shadow-sm transition-all duration-150"
                                        onClick={exportToCsv}
                                    >
                                        <FaDownload className="mr-1.5 text-green-200" /> Export CSV
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-secondary-700">
                                        <thead className="bg-gray-50 dark:bg-secondary-800/70">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Ledger Head
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Opening Balance
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Receipts
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Payments
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Closing Balance
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Cash In Hand
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Cash In Bank
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-secondary-900 divide-y divide-gray-200 dark:divide-secondary-700">
                                            {monthlyBalances.map((balance) => (
                                                <tr key={balance.id} className="hover:bg-gray-50 dark:hover:bg-secondary-800/50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                        {balance.ledgerHead?.name || 'Unknown'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                                                        {formatCurrency(balance.opening_balance)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 dark:text-green-400">
                                                        {formatCurrency(balance.receipts)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400">
                                                        {formatCurrency(balance.payments)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(balance.closing_balance)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                                                        {formatCurrency(balance.cash_in_hand)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                                                        {formatCurrency(balance.cash_in_bank)}
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Totals row */}
                                            <tr className="bg-gray-100 dark:bg-secondary-800 font-semibold">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    TOTALS
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                                                    {formatCurrency(totals.openingBalance)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 dark:text-green-400">
                                                    {formatCurrency(totals.receipts)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700 dark:text-red-400">
                                                    {formatCurrency(totals.payments)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                                                    {formatCurrency(totals.closingBalance)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                                                    {formatCurrency(totals.cashInHand)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                                                    {formatCurrency(totals.cashInBank)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            selectedAccountId && (
                                <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-md p-8 text-center text-gray-500 dark:text-gray-400">
                                    <FaFileAlt className="mx-auto mb-3 text-4xl opacity-50" />
                                    <p>No monthly data found for the selected period</p>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Set page title
MonthlyReports.pageTitle = "Monthly Ledger Reports"; 