import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    FaChartLine,
    FaSearch,
    FaFileDownload,
    FaLock,
    FaLockOpen,
    FaFilter,
    FaFileAlt,
    FaPlus,
    FaMinus,
    FaAngleRight,
    FaAngleDown
} from 'react-icons/fa';
import API_CONFIG from '../config';

export default function MonthlySnapshots() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [monthlyData, setMonthlyData] = useState({});
    const [expandedMonths, setExpandedMonths] = useState({});
    const [periodStatuses, setPeriodStatuses] = useState({});
    const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'open', 'closed'
    const [yearTotals, setYearTotals] = useState({
        receipts: 0,
        payments: 0,
        balance: 0,
        cash: 0,
        bank: 0
    });

    // Fetch accounts on page load
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch data when selection changes
    useEffect(() => {
        if (selectedAccountId && selectedYear) {
            fetchMonthlyData();
            fetchPeriodStatuses();
        }
    }, [selectedAccountId, selectedYear]);

    // Calculate year totals when monthly data changes
    useEffect(() => {
        calculateYearTotals();
    }, [monthlyData]);

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

    // Fetch period closure status
    const fetchPeriodStatuses = async () => {
        try {
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/status`
            );

            if (response.data.success) {
                const accounts = response.data.data;
                const selectedAccount = accounts.find(account => account.id === parseInt(selectedAccountId));

                if (selectedAccount && selectedAccount.last_closed_date) {
                    const lastClosedDate = new Date(selectedAccount.last_closed_date);
                    const statuses = {};

                    // For each month in the selected year, determine if it's open or closed
                    for (let month = 1; month <= 12; month++) {
                        const lastDayOfMonth = new Date(selectedYear, month, 0);
                        statuses[month] = lastClosedDate < lastDayOfMonth;
                    }

                    setPeriodStatuses(statuses);
                } else {
                    // If no closed date, all periods are open
                    const statuses = {};
                    for (let month = 1; month <= 12; month++) {
                        statuses[month] = true;
                    }
                    setPeriodStatuses(statuses);
                }
            }
        } catch (err) {
            console.error('Error checking period status:', err);
            // Default to open if we can't determine
            const statuses = {};
            for (let month = 1; month <= 12; month++) {
                statuses[month] = true;
            }
            setPeriodStatuses(statuses);
        }
    };

    // Fetch monthly data
    const fetchMonthlyData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all months for the selected year
            const monthData = {};

            for (let month = 1; month <= 12; month++) {
                const response = await axios.get(
                    `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-ledger-balances`,
                    {
                        params: {
                            account_id: selectedAccountId,
                            month: month,
                            year: selectedYear
                        }
                    }
                );

                if (response.data.success) {
                    monthData[month] = {
                        balances: response.data.data,
                        totals: calculateMonthTotals(response.data.data)
                    };
                } else {
                    monthData[month] = {
                        balances: [],
                        totals: { receipts: 0, payments: 0, balance: 0, cashInHand: 0, cashInBank: 0 }
                    };
                }
            }

            setMonthlyData(monthData);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
            toast.error('Error loading monthly data');
        } finally {
            setLoading(false);
        }
    };

    // Calculate totals for a single month
    const calculateMonthTotals = (balances) => {
        return balances.reduce(
            (acc, balance) => {
                return {
                    receipts: acc.receipts + parseFloat(balance.receipts || 0),
                    payments: acc.payments + parseFloat(balance.payments || 0),
                    balance: acc.balance + parseFloat(balance.closing_balance || 0),
                    cashInHand: acc.cashInHand + parseFloat(balance.cash_in_hand || 0),
                    cashInBank: acc.cashInBank + parseFloat(balance.cash_in_bank || 0)
                };
            },
            { receipts: 0, payments: 0, balance: 0, cashInHand: 0, cashInBank: 0 }
        );
    };

    // Calculate totals for the entire year
    const calculateYearTotals = () => {
        let totals = {
            receipts: 0,
            payments: 0,
            balance: 0,
            cash: 0,
            bank: 0
        };

        Object.values(monthlyData).forEach(month => {
            totals.receipts += month.totals.receipts;
            totals.payments += month.totals.payments;
            totals.balance = month.totals.balance; // Last month's closing balance
            totals.cash += month.totals.cashInHand;
            totals.bank += month.totals.cashInBank;
        });

        setYearTotals(totals);
    };

    // Toggle month expansion
    const toggleMonth = (month) => {
        setExpandedMonths({
            ...expandedMonths,
            [month]: !expandedMonths[month]
        });
    };

    // Toggle all months
    const toggleAllMonths = (expand) => {
        const newExpandedState = {};
        for (let month = 1; month <= 12; month++) {
            newExpandedState[month] = expand;
        }
        setExpandedMonths(newExpandedState);
    };

    // Export to CSV
    const exportToCsv = () => {
        // Implementation for CSV export would go here
        toast.info('CSV export functionality will be implemented soon');
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

    // Filter months based on open/closed status
    const getFilteredMonths = () => {
        if (activeFilter === 'all') {
            return Array.from({ length: 12 }, (_, i) => i + 1);
        } else if (activeFilter === 'open') {
            return Object.entries(periodStatuses)
                .filter(([_, isOpen]) => isOpen)
                .map(([month]) => parseInt(month));
        } else {
            return Object.entries(periodStatuses)
                .filter(([_, isOpen]) => !isOpen)
                .map(([month]) => parseInt(month));
        }
    };

    // Render period status badge
    const renderStatusBadge = (isOpen, size = 'md') => {
        const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs';

        if (isOpen) {
            return (
                <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium bg-green-100 text-green-800`}>
                    <FaLockOpen className="mr-1" size={size === 'sm' ? 10 : 12} />
                    Open
                </span>
            );
        } else {
            return (
                <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium bg-gray-100 text-gray-800`}>
                    <FaLock className="mr-1" size={size === 'sm' ? 10 : 12} />
                    Closed
                </span>
            );
        }
    };

    return (
        <div className="page-content-wrapper">
            <div className="w-full space-y-4 animate-fadeIn">
                {/* Header */}
                <div className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <FaChartLine className="text-indigo-600 text-xl mr-2" />
                        <h1 className="text-xl font-semibold text-gray-900">Ledger Balance Snapshots</h1>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => exportToCsv()}
                            className="bg-green-600 text-white py-2 px-4 rounded-md text-sm flex items-center"
                        >
                            <FaFileDownload className="mr-2" /> CSV
                        </button>
                        <button
                            onClick={() => fetchMonthlyData()}
                            className="bg-indigo-600 text-white py-2 px-4 rounded-md text-sm flex items-center"
                        >
                            <FaSearch className="mr-2" /> Generate Report
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-md"
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
                    <div className="bg-white rounded-lg shadow p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Financial Year</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-md"
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

                {/* Filter tabs */}
                <div className="bg-white rounded-lg shadow">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-4 px-4">
                            <button
                                className={`py-3 px-3 text-sm font-medium flex items-center border-b-2 ${activeFilter === 'all'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                onClick={() => setActiveFilter('all')}
                            >
                                <FaFilter className="mr-2" /> All Months
                            </button>
                            <button
                                className={`py-3 px-3 text-sm font-medium flex items-center border-b-2 ${activeFilter === 'closed'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                onClick={() => setActiveFilter('closed')}
                            >
                                <FaLock className="mr-2" /> Closed Periods
                            </button>
                            <button
                                className={`py-3 px-3 text-sm font-medium flex items-center border-b-2 ${activeFilter === 'open'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                onClick={() => setActiveFilter('open')}
                            >
                                <FaLockOpen className="mr-2" /> Open Periods
                            </button>
                        </nav>
                    </div>

                    {/* Toggle expand/collapse all */}
                    <div className="flex justify-end p-2 text-sm text-gray-600">
                        <button onClick={() => toggleAllMonths(true)} className="flex items-center mr-4">
                            <FaPlus size={10} className="mr-1" /> Expand All
                        </button>
                        <button onClick={() => toggleAllMonths(false)} className="flex items-center">
                            <FaMinus size={10} className="mr-1" /> Collapse All
                        </button>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-emerald-500 text-white rounded-lg shadow p-4">
                        <div className="text-sm opacity-80">TOTAL RECEIPTS</div>
                        <div className="text-2xl font-bold mt-1">{formatCurrency(yearTotals.receipts)}</div>
                        <div className="text-xs mt-2">Year {selectedYear}</div>
                    </div>
                    <div className="bg-red-500 text-white rounded-lg shadow p-4">
                        <div className="text-sm opacity-80">TOTAL PAYMENTS</div>
                        <div className="text-2xl font-bold mt-1">{formatCurrency(yearTotals.payments)}</div>
                        <div className="text-xs mt-2">Year {selectedYear}</div>
                    </div>
                    <div className="bg-indigo-600 text-white rounded-lg shadow p-4">
                        <div className="text-sm opacity-80">NET BALANCE</div>
                        <div className="text-2xl font-bold mt-1">{formatCurrency(yearTotals.balance)}</div>
                        <div className="text-xs mt-2">Year {selectedYear}</div>
                    </div>
                    <div className="bg-blue-500 text-white rounded-lg shadow p-4">
                        <div className="text-sm opacity-80">CASH</div>
                        <div className="text-2xl font-bold mt-1">{formatCurrency(yearTotals.cash)}</div>
                        <div className="text-xs mt-2">Latest Balance</div>
                    </div>
                    <div className="bg-blue-700 text-white rounded-lg shadow p-4">
                        <div className="text-sm opacity-80">BANK</div>
                        <div className="text-2xl font-bold mt-1">{formatCurrency(yearTotals.bank)}</div>
                        <div className="text-xs mt-2">Latest Balance</div>
                    </div>
                </div>

                {/* Month accordions */}
                {loading ? (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                        <div className="mt-4 text-gray-600">Loading data...</div>
                    </div>
                ) : (
                    <>
                        {getFilteredMonths().map((month) => (
                            <div key={month} className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
                                <div
                                    className="p-4 cursor-pointer flex justify-between items-center bg-gray-50 border-b border-gray-100"
                                    onClick={() => toggleMonth(month)}
                                >
                                    <div className="flex items-center">
                                        {expandedMonths[month] ? (
                                            <FaAngleDown className="text-gray-500 mr-2" />
                                        ) : (
                                            <FaAngleRight className="text-gray-500 mr-2" />
                                        )}
                                        <span className="font-medium">{getMonthName(month)} {selectedYear}</span>

                                        {/* Period status badge */}
                                        <div className="ml-3">
                                            {renderStatusBadge(periodStatuses[month], 'sm')}
                                        </div>
                                    </div>

                                    <div className="flex space-x-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Receipts</span>
                                            <span className="ml-2 text-green-600 font-medium">
                                                {formatCurrency(monthlyData[month]?.totals.receipts || 0)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Payments</span>
                                            <span className="ml-2 text-red-600 font-medium">
                                                {formatCurrency(monthlyData[month]?.totals.payments || 0)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Balance</span>
                                            <span className="ml-2 text-gray-900 font-medium">
                                                {formatCurrency(monthlyData[month]?.totals.balance || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {expandedMonths[month] && (
                                    <div>
                                        {monthlyData[month]?.balances.length > 0 ? (
                                            <table className="w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Ledger Head
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Opening Balance
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Receipts
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Payments
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Closing Balance
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Cash In Hand
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Cash In Bank
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {monthlyData[month].balances.map((balance) => (
                                                        <tr key={balance.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                {balance.ledgerHead?.name || 'Unknown'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                                                {formatCurrency(balance.opening_balance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                                                                {formatCurrency(balance.receipts)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                                                                {formatCurrency(balance.payments)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                                                {formatCurrency(balance.closing_balance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                                                {formatCurrency(balance.cash_in_hand)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                                                {formatCurrency(balance.cash_in_bank)}
                                                            </td>
                                                        </tr>
                                                    ))}

                                                    {/* Totals row */}
                                                    <tr className="bg-gray-100 font-medium">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            TOTAL
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            {/* Opening balance total not calculated */}
                                                            {formatCurrency(0)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700">
                                                            {formatCurrency(monthlyData[month]?.totals.receipts || 0)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700">
                                                            {formatCurrency(monthlyData[month]?.totals.payments || 0)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                                            {formatCurrency(monthlyData[month]?.totals.balance || 0)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            {formatCurrency(monthlyData[month]?.totals.cashInHand || 0)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                            {formatCurrency(monthlyData[month]?.totals.cashInBank || 0)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-6 text-center text-gray-500">
                                                <FaFileAlt className="mx-auto mb-2 text-2xl opacity-30" />
                                                <p>No data available for {getMonthName(month)} {selectedYear}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

// Set page title
MonthlySnapshots.pageTitle = "Ledger Balance Snapshots"; 