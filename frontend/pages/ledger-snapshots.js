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
    FaUnlock
} from 'react-icons/fa';
import API_CONFIG from '../config';
import Layout from '../components/Layout';

export default function LedgerSnapshots() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [monthlySnapshots, setMonthlySnapshots] = useState([]);
    const [accountClosureStatus, setAccountClosureStatus] = useState({});
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'closed', 'open'

    // Years range for filter
    const years = Array.from(
        { length: 10 },
        (_, i) => new Date().getFullYear() - 5 + i
    );

    // Fetch accounts on page load
    useEffect(() => {
        fetchAccounts();
        fetchAccountClosureStatus();
    }, []);

    // Fetch monthly snapshots when selection changes
    useEffect(() => {
        if (selectedAccountId && selectedYear) {
            fetchMonthlySnapshots();
        }
    }, [selectedAccountId, selectedYear]);

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
    const fetchMonthlySnapshots = async () => {
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

    // Check if a month is closed
    const isMonthClosed = (month) => {
        // If account closure status is not available, assume everything is open
        const accountStatus = accountClosureStatus[selectedAccountId];
        if (!accountStatus || !accountStatus.last_closed_date) return false;

        const lastClosedDate = new Date(accountStatus.last_closed_date);
        const lastClosedMonth = lastClosedDate.getMonth() + 1;
        const lastClosedYear = lastClosedDate.getFullYear();

        // Month is closed if it's in a previous year or same year but earlier/same month
        return (
            selectedYear < lastClosedYear ||
            (selectedYear === lastClosedYear && month <= lastClosedMonth)
        );
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

    // Render a table for a specific month
    const renderMonthTable = (month) => {
        const snapshots = monthlySnapshots.filter(s => s.month === month);
        const totals = getMonthlyTotals(month);
        const isClosed = isMonthClosed(month);

        if (snapshots.length === 0) {
            return (
                <div className="mb-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                            {getMonthName(month)} {selectedYear}
                            {isClosed && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <FaLock className="w-3 h-3 mr-1" /> Closed
                                </span>
                            )}
                        </h3>
                    </div>
                    <p className="text-gray-500 text-sm">No data available for this month</p>
                </div>
            );
        }

        return (
            <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className={`px-4 py-3 flex justify-between items-center ${isClosed ? 'bg-blue-50 border-b border-blue-100' : 'bg-gray-50 border-b border-gray-100'}`}>
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        {getMonthName(month)} {selectedYear}
                        {isClosed ? (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <FaLock className="w-3 h-3 mr-1" /> Closed
                            </span>
                        ) : (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <FaUnlock className="w-3 h-3 mr-1" /> Open
                            </span>
                        )}
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ledger Head
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Opening Balance
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Receipts
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Payments
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Closing Balance
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cash In Hand
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cash In Bank
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {snapshots.map((snapshot) => (
                                <tr key={snapshot.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {snapshot.ledgerHead?.name || 'Unknown'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {formatCurrency(snapshot.opening_balance)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                                        {formatCurrency(snapshot.receipts)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                                        {formatCurrency(snapshot.payments)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                        {formatCurrency(snapshot.closing_balance)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {formatCurrency(snapshot.cash_in_hand)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {formatCurrency(snapshot.cash_in_bank)}
                                    </td>
                                </tr>
                            ))}

                            {/* Totals row */}
                            <tr className="bg-gray-100 font-semibold">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    TOTALS
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {formatCurrency(totals.openingBalance)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700">
                                    {formatCurrency(totals.receipts)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700">
                                    {formatCurrency(totals.payments)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                    {formatCurrency(totals.closingBalance)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {formatCurrency(totals.cashInHand)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {formatCurrency(totals.cashInBank)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 py-6">
                <h1 className="text-2xl font-semibold mb-6 flex items-center">
                    <FaChartLine className="mr-2" /> Ledger Balance Snapshots
                </h1>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md mb-6 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Account selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Account
                            </label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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

                        {/* Year selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Year
                            </label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-end space-x-2">
                            <button
                                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md flex items-center justify-center hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                onClick={fetchMonthlySnapshots}
                                disabled={!selectedAccountId}
                            >
                                <FaSearch className="mr-2" /> Generate Report
                            </button>

                            <button
                                className="bg-green-600 text-white py-2 px-4 rounded-md flex items-center justify-center hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                onClick={exportToCsv}
                                disabled={monthlySnapshots.length === 0}
                            >
                                <FaDownload className="mr-2" /> Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tab selector */}
                <div className="flex space-x-2 mb-6">
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'all' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Months
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'closed' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        onClick={() => setActiveTab('closed')}
                    >
                        <FaLock className="inline mr-1" /> Closed Periods
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        onClick={() => setActiveTab('open')}
                    >
                        <FaUnlock className="inline mr-1" /> Open Periods
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center">
                        <FaExclamationCircle className="mr-2" />
                        <span>{error}</span>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center p-6 bg-white rounded-lg shadow-md">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <>
                        {monthlySnapshots.length > 0 ? (
                            <div className="space-y-6">
                                {/* Year summary */}
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow-md p-4 mb-6">
                                    <h2 className="text-xl font-bold mb-2">Annual Summary {selectedYear}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white bg-opacity-20 rounded-lg p-3">
                                            <div className="text-sm opacity-80">Total Receipts</div>
                                            <div className="text-2xl font-bold">
                                                {formatCurrency(monthlySnapshots.reduce((sum, s) => sum + parseFloat(s.receipts || 0), 0))}
                                            </div>
                                        </div>
                                        <div className="bg-white bg-opacity-20 rounded-lg p-3">
                                            <div className="text-sm opacity-80">Total Payments</div>
                                            <div className="text-2xl font-bold">
                                                {formatCurrency(monthlySnapshots.reduce((sum, s) => sum + parseFloat(s.payments || 0), 0))}
                                            </div>
                                        </div>
                                        <div className="bg-white bg-opacity-20 rounded-lg p-3">
                                            <div className="text-sm opacity-80">Net Balance</div>
                                            <div className="text-2xl font-bold">
                                                {formatCurrency(
                                                    monthlySnapshots.reduce((sum, s) => sum + parseFloat(s.receipts || 0), 0) -
                                                    monthlySnapshots.reduce((sum, s) => sum + parseFloat(s.payments || 0), 0)
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Monthly tables */}
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
                        ) : (
                            selectedAccountId && (
                                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                                    <FaTable className="mx-auto mb-3 text-4xl" />
                                    <p>No monthly data found for the selected account and year</p>
                                    <p className="text-sm mt-2">Try selecting a different account or year</p>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
} 