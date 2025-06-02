import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    FaChartLine,
    FaCalendarAlt,
    FaTable,
    FaSearch,
    FaDownload,
    FaExclamationCircle,
    FaLock,
    FaUnlock,
    FaRegMoneyBillAlt,
    FaRegFileAlt,
    FaPrint,
    FaChevronDown,
    FaChevronRight,
    FaWallet,
    FaUniversity,
    FaSyncAlt,
    FaFilter
} from 'react-icons/fa';
import API_CONFIG from '../config';

export default function LedgerSnapshots() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [monthlySnapshots, setMonthlySnapshots] = useState([]);
    const [accountClosureStatus, setAccountClosureStatus] = useState({});
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'closed', 'open'
    const [collapsedMonths, setCollapsedMonths] = useState({});

    // Years range for filter
    const years = Array.from(
        { length: 10 },
        (_, i) => new Date().getFullYear() - 5 + i
    );

    // Use effect for initial data loading
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Load account data and fetch snapshots whenever account is selected
    useEffect(() => {
        if (selectedAccountId) {
            fetchSnapshotsForYear();
            fetchAccountClosureStatus();
        }
    }, [selectedAccountId, selectedYear]);

    // Toggle month collapse state
    const toggleMonthCollapse = (month) => {
        setCollapsedMonths(prev => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    // Fetch all accounts
    const fetchAccounts = async () => {
        try {
            setLoading(true);
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
            setLoading(false);
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || err.message || 'An error occurred');
            toast.error('Error loading accounts');
        }
    };

    // Fetch account closure status
    const fetchAccountClosureStatus = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/status`);

            if (response.data.success) {
                // Convert array to object with account_id as key
                const statusObj = {};
                response.data.data.forEach(item => {
                    statusObj[item.id] = {
                        status: item.status || 'never_closed',
                        last_closed_date: item.last_closed_date || null
                    };
                });
                setAccountClosureStatus(statusObj);
            }
        } catch (err) {
            console.error('Error fetching account closure status, using defaults:', err);
            // Still proceed with defaults
            if (accounts && accounts.length > 0) {
                const statusObj = {};
                accounts.forEach(account => {
                    statusObj[account.id] = {
                        status: 'never_closed',
                        last_closed_date: null
                    };
                });
                setAccountClosureStatus(statusObj);
            }
        }
    };

    // Fetch monthly snapshots for all months in the selected year
    const fetchSnapshotsForYear = async () => {
        setLoading(true);
        setError(null);

        try {
            const promises = [];

            // Fetch data for all 12 months
            for (let month = 1; month <= 12; month++) {
                promises.push(
                    axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-ledger-balances`, {
                        params: {
                            account_id: selectedAccountId,
                            month: month,
                            year: selectedYear
                        }
                    })
                );
            }

            // Wait for all requests to complete
            const results = await Promise.all(promises);

            // Process results
            const allSnapshots = [];
            results.forEach((response, index) => {
                if (response.data.success) {
                    const monthData = response.data.data.map(item => ({
                        ...item,
                        month: index + 1 // Add month (1-12) to each item
                    }));
                    allSnapshots.push(...monthData);
                }
            });

            // Sort by month
            allSnapshots.sort((a, b) => a.month - b.month);

            setMonthlySnapshots(allSnapshots);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
            setMonthlySnapshots([]);
        } finally {
            setLoading(false);
        }
    };

    // Export data to CSV
    const exportToCsv = () => {
        if (monthlySnapshots.length === 0) {
            toast.warning('No data to export');
            return;
        }

        // Group data by month
        const monthlyData = {};
        monthlySnapshots.forEach(snapshot => {
            if (!monthlyData[snapshot.month]) {
                monthlyData[snapshot.month] = [];
            }
            monthlyData[snapshot.month].push(snapshot);
        });

        // Build CSV content
        let csvContent = "Month,Ledger Head,Opening Balance,Receipts,Payments,Closing Balance,Cash In Hand,Cash In Bank\n";

        for (let month = 1; month <= 12; month++) {
            const snapshots = monthlyData[month] || [];
            const monthName = getMonthName(month);

            if (snapshots.length === 0) {
                csvContent += `${monthName},No data available,,,,,\n`;
            } else {
                snapshots.forEach(snapshot => {
                    csvContent += `${monthName},${snapshot.ledgerHead?.name || 'Unknown'},${snapshot.opening_balance},${snapshot.receipts},${snapshot.payments},${snapshot.closing_balance},${snapshot.cash_in_hand},${snapshot.cash_in_bank}\n`;
                });
            }
        }

        // Create download link
        const selectedAccount = accounts.find(account => account.id === parseInt(selectedAccountId));
        const accountName = selectedAccount ? selectedAccount.name : 'account';
        const filename = `${accountName}_${selectedYear}_ledger_snapshots.csv`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
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

    // Check if a month is closed based on last_closed_date
    const isMonthClosed = (month) => {
        if (!selectedAccountId || !accountClosureStatus[selectedAccountId] ||
            !accountClosureStatus[selectedAccountId].last_closed_date) {
            return false;
        }

        const lastClosedDate = new Date(accountClosureStatus[selectedAccountId].last_closed_date);
        const monthEndDate = new Date(selectedYear, month, 0); // Last day of the month

        // Month is closed if the month end date is on or before the last closed date
        return monthEndDate <= lastClosedDate;
    };

    // Group snapshots by month
    const getSnapshotsByMonth = () => {
        const grouped = {};

        for (let month = 1; month <= 12; month++) {
            grouped[month] = monthlySnapshots.filter(s => s.month === month);
        }

        return grouped;
    };

    // Calculate monthly totals
    const getMonthlyTotals = (month) => {
        const snapshots = monthlySnapshots.filter(s => s.month === month);

        return snapshots.reduce(
            (totals, snapshot) => ({
                openingBalance: totals.openingBalance + parseFloat(snapshot.opening_balance || 0),
                receipts: totals.receipts + parseFloat(snapshot.receipts || 0),
                payments: totals.payments + parseFloat(snapshot.payments || 0),
                closingBalance: totals.closingBalance + parseFloat(snapshot.closing_balance || 0),
                cashInHand: totals.cashInHand + parseFloat(snapshot.cash_in_hand || 0),
                cashInBank: totals.cashInBank + parseFloat(snapshot.cash_in_bank || 0)
            }),
            { openingBalance: 0, receipts: 0, payments: 0, closingBalance: 0, cashInHand: 0, cashInBank: 0 }
        );
    };

    // Get summary for annual data
    const getAnnualSummary = () => {
        return monthlySnapshots.reduce(
            (totals, snapshot) => ({
                receipts: totals.receipts + parseFloat(snapshot.receipts || 0),
                payments: totals.payments + parseFloat(snapshot.payments || 0),
                cashInHand: Math.max(totals.cashInHand, parseFloat(snapshot.cash_in_hand || 0)),
                cashInBank: Math.max(totals.cashInBank, parseFloat(snapshot.cash_in_bank || 0))
            }),
            { receipts: 0, payments: 0, cashInHand: 0, cashInBank: 0 }
        );
    };

    // Render month table with visual indication for closed periods
    const renderMonthTable = (month) => {
        const monthName = getMonthName(month);
        const monthData = getSnapshotsByMonth()[month] || [];
        const monthTotals = getMonthlyTotals(month);
        const closed = isMonthClosed(month);
        const isCollapsed = collapsedMonths[month];

        return (
            <div key={month}
                className={`mb-6 rounded-xl overflow-hidden shadow-md transition-all duration-300 ${closed ? 'border-l-4 border-gray-400' : 'border-l-4 border-green-400'
                    }`}>
                {/* Month header */}
                <div
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 cursor-pointer ${closed
                        ? 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
                        : 'bg-gradient-to-r from-emerald-50 to-teal-100 text-teal-800'
                        }`}
                    onClick={() => toggleMonthCollapse(month)}
                >
                    <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                        {isCollapsed ?
                            <FaChevronRight className="text-xs opacity-70" /> :
                            <FaChevronDown className="text-xs opacity-70" />
                        }
                        <h3 className="text-lg font-bold">
                            {monthName} {selectedYear}
                        </h3>
                        {closed && (
                            <span className="ml-2 flex items-center text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                                <FaLock className="mr-1 text-xs" /> Closed
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                        <div className="text-right">
                            <span className="block text-xs opacity-70">Receipts</span>
                            <span className="font-semibold text-green-600">{formatCurrency(monthTotals.receipts)}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-xs opacity-70">Payments</span>
                            <span className="font-semibold text-red-600">{formatCurrency(monthTotals.payments)}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-xs opacity-70">Balance</span>
                            <span className="font-semibold">{formatCurrency(monthTotals.closingBalance)}</span>
                        </div>
                    </div>
                </div>

                {/* Month content */}
                {!isCollapsed && (
                    <div className={`transition-all duration-300 ${closed ? 'bg-gray-50' : 'bg-white'}`}>
                        {monthData.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[800px]">
                                    <thead className={`text-xs uppercase ${closed ? 'bg-gray-200 text-gray-600' : 'bg-teal-50 text-teal-700'}`}>
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold tracking-wider">
                                                Ledger Head
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold tracking-wider">
                                                Opening Balance
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold tracking-wider">
                                                Receipts
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold tracking-wider">
                                                Payments
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold tracking-wider">
                                                Closing Balance
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold tracking-wider">
                                                Cash In Hand
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold tracking-wider">
                                                Cash In Bank
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y divide-gray-200 ${closed ? 'text-gray-600' : 'text-gray-700'}`}>
                                        {monthData.map((snapshot, idx) => (
                                            <tr key={idx} className={`transition-colors hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                <td className="px-4 py-3 text-sm font-medium">
                                                    {snapshot.ledgerHead?.name || 'Unknown'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    {formatCurrency(snapshot.opening_balance)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                                                    {formatCurrency(snapshot.receipts)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                                                    {formatCurrency(snapshot.payments)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-semibold">
                                                    {formatCurrency(snapshot.closing_balance)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    {formatCurrency(snapshot.cash_in_hand)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    {formatCurrency(snapshot.cash_in_bank)}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Month totals row */}
                                        <tr className={`font-bold ${closed ? 'bg-gray-200 text-gray-800' : 'bg-teal-50 text-teal-900'}`}>
                                            <td className="px-4 py-3 text-sm">
                                                TOTAL
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {formatCurrency(monthTotals.openingBalance)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-green-700">
                                                {formatCurrency(monthTotals.receipts)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-red-700">
                                                {formatCurrency(monthTotals.payments)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {formatCurrency(monthTotals.closingBalance)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {formatCurrency(monthTotals.cashInHand)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {formatCurrency(monthTotals.cashInBank)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={`p-6 text-center ${closed ? 'bg-gray-50' : 'bg-white'}`}>
                                <FaRegFileAlt className="mx-auto text-3xl text-gray-300 mb-2" />
                                <p className="text-gray-500">No data available for {monthName} {selectedYear}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Render annual stats cards
    const renderAnnualStats = () => {
        if (monthlySnapshots.length === 0) return null;

        const summary = getAnnualSummary();
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs uppercase tracking-wider opacity-80">Total Receipts</h3>
                        <FaRegMoneyBillAlt className="text-xl opacity-70" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(summary.receipts)}</div>
                    <div className="mt-2 text-xs text-emerald-100">Year {selectedYear}</div>
                </div>

                <div className="bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs uppercase tracking-wider opacity-80">Total Payments</h3>
                        <FaRegMoneyBillAlt className="text-xl opacity-70" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(summary.payments)}</div>
                    <div className="mt-2 text-xs text-red-100">Year {selectedYear}</div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs uppercase tracking-wider opacity-80">Net Balance</h3>
                        <FaChartLine className="text-xl opacity-70" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(summary.receipts - summary.payments)}</div>
                    <div className="mt-2 text-xs text-indigo-100">Year {selectedYear}</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-sky-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                        <div className="flex-1">
                            <div className="flex items-center mb-2">
                                <FaWallet className="mr-2 opacity-70 text-xs" />
                                <span className="text-xs uppercase tracking-wider opacity-80">Cash</span>
                            </div>
                            <div className="text-lg font-bold">{formatCurrency(summary.cashInHand)}</div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center mb-2">
                                <FaUniversity className="mr-2 opacity-70 text-xs" />
                                <span className="text-xs uppercase tracking-wider opacity-80">Bank</span>
                            </div>
                            <div className="text-lg font-bold">{formatCurrency(summary.cashInBank)}</div>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-blue-100">Latest Balance</div>
                </div>
            </div>
        );
    };

    return (
        <div className="page-content-wrapper">
            <div className="w-full space-y-5 animate-fadeIn">
                {/* Page Header */}
                <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-secondary-700">
                        <div className="flex items-center gap-2 mb-3 sm:mb-0">
                            <FaChartLine className="text-indigo-600 text-xl" />
                            <h2 className="text-lg sm:text-xl font-semibold text-secondary-900 dark:text-white">
                                Ledger Balance Snapshots
                            </h2>
                        </div>

                        <div className="w-full sm:w-auto flex flex-wrap gap-2">
                            <button
                                className="flex-1 sm:flex-none px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium flex items-center justify-center shadow-sm transition-all duration-150"
                                onClick={fetchSnapshotsForYear}
                                disabled={!selectedAccountId || loading}
                            >
                                {loading ? <FaSyncAlt className="mr-1.5 animate-spin" /> : <FaSearch className="mr-1.5" />}
                                Generate Report
                            </button>

                            <button
                                className="flex-1 sm:flex-none px-3 py-2 text-xs bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium flex items-center justify-center shadow-sm transition-all duration-150"
                                onClick={exportToCsv}
                                disabled={monthlySnapshots.length === 0}
                            >
                                <FaDownload className="mr-1.5 text-green-200" /> CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Section */}
                <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Account selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center">
                                <FaUniversity className="mr-1.5 text-indigo-500" /> Account
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
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <FaChevronDown className="h-4 w-4" />
                                </div>
                            </div>
                        </div>

                        {/* Year selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center">
                                <FaCalendarAlt className="mr-1.5 text-indigo-500" /> Financial Year
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <select
                                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                >
                                    {years.map(year => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <FaChevronDown className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Filters */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap bg-gray-100 text-gray-700 rounded-lg p-1 shadow-sm">
                        <button
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'all' ?
                                'bg-white text-indigo-700 shadow-sm' :
                                'hover:bg-gray-200'}`}
                            onClick={() => setActiveTab('all')}
                        >
                            <FaFilter className="inline mr-1.5 text-xs" />
                            All Months
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'closed' ?
                                'bg-white text-indigo-700 shadow-sm' :
                                'hover:bg-gray-200'}`}
                            onClick={() => setActiveTab('closed')}
                        >
                            <FaLock className="inline mr-1.5 text-xs" />
                            Closed Periods
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'open' ?
                                'bg-white text-indigo-700 shadow-sm' :
                                'hover:bg-gray-200'}`}
                            onClick={() => setActiveTab('open')}
                        >
                            <FaUnlock className="inline mr-1.5 text-xs" />
                            Open Periods
                        </button>
                    </div>

                    <div className="flex gap-2 text-sm">
                        <button
                            className="text-indigo-600 hover:text-indigo-800 flex items-center"
                            onClick={() => setCollapsedMonths(
                                Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, false]))
                            )}
                        >
                            <FaChevronDown className="mr-1 text-xs" /> Expand All
                        </button>

                        <button
                            className="text-indigo-600 hover:text-indigo-800 flex items-center"
                            onClick={() => setCollapsedMonths(
                                Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, true]))
                            )}
                        >
                            <FaChevronRight className="mr-1 text-xs" /> Collapse All
                        </button>
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
                        {monthlySnapshots.length > 0 ? (
                            <div className="space-y-5">
                                {/* Annual summary cards */}
                                {renderAnnualStats()}

                                {/* Monthly tables */}
                                <div className="space-y-4">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                                        const isClosed = isMonthClosed(month);
                                        const hasData = monthlySnapshots.some(s => s.month === month);

                                        // Filter based on active tab
                                        if (
                                            (activeTab === 'closed' && !isClosed) ||
                                            (activeTab === 'open' && isClosed) ||
                                            (!hasData && activeTab !== 'all')
                                        ) {
                                            return null;
                                        }

                                        return renderMonthTable(month);
                                    })}
                                </div>
                            </div>
                        ) : (
                            selectedAccountId && (
                                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                                    <FaTable className="mx-auto text-4xl text-gray-300 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-700 mb-2">No Data Available</h3>
                                    <p className="text-gray-500 max-w-md mx-auto mb-4">
                                        No monthly data found for the selected account and year.
                                        Try selecting a different account or year.
                                    </p>
                                    <button
                                        onClick={fetchSnapshotsForYear}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        <FaSyncAlt className="mr-2 -ml-1" /> Refresh Data
                                    </button>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Set page title for MainLayout
LedgerSnapshots.pageTitle = "Ledger Balance Snapshots";