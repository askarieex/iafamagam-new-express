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
    FaFilter,
    FaFileDownload,
    FaLockOpen,
    FaPlus,
    FaMinus,
    FaAngleRight,
    FaAngleDown
} from 'react-icons/fa';
import API_CONFIG from '../config';
import PeriodStatusBadge from '../components/reports/PeriodStatusBadge';

export default function LedgerSnapshots() {
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
        if (selectedAccountId && selectedYear) {
            fetchMonthlyData();
            fetchPeriodStatuses();
        }
    }, [selectedAccountId, selectedYear]);

    // Calculate year totals when monthly data changes
    useEffect(() => {
        calculateYearTotals();
    }, [monthlyData]);

    // Toggle month expansion
    const toggleMonth = (month) => {
        setExpandedMonths(prev => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    // Toggle all months
    const toggleAllMonths = (expand) => {
        const newExpandedState = {};
        for (let month = 1; month <= 12; month++) {
            newExpandedState[month] = expand;
        }
        setExpandedMonths(newExpandedState);
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

    // Fetch period closure status
    const fetchPeriodStatuses = async () => {
        try {
            // First, get the currently open period for this account
            const openPeriodResponse = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/open-period`,
                {
                    params: {
                        account_id: selectedAccountId
                    }
                }
            );

            // Set all periods to closed by default
            const statuses = {};
            for (let month = 1; month <= 12; month++) {
                statuses[month] = false; // Default all to closed
            }

            // If we have an open period, mark only that one as open
            if (openPeriodResponse.data.success && openPeriodResponse.data.data) {
                const openPeriod = openPeriodResponse.data.data;

                // Check if the open period is in the selected year
                if (openPeriod.year === selectedYear) {
                    statuses[openPeriod.month] = true; // Only this period is open
                }
            }

            setPeriodStatuses(statuses);
        } catch (err) {
            console.error('Error checking period status:', err);
            // Default all to closed if we can't determine
            const statuses = {};
            for (let month = 1; month <= 12; month++) {
                statuses[month] = false;
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

    // Export data to CSV
    const exportToCsv = () => {
        if (Object.values(monthlyData).length === 0) {
            toast.warning('No data to export');
            return;
        }

        // Group data by month
        const monthlyData = {};
        Object.entries(this.state.monthlyData).forEach(([month, data]) => {
            if (!monthlyData[month]) {
                monthlyData[month] = [];
            }
            monthlyData[month].push(data);
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
                                onClick={fetchMonthlyData}
                                disabled={!selectedAccountId || loading}
                            >
                                {loading ? <FaSyncAlt className="mr-1.5 animate-spin" /> : <FaSearch className="mr-1.5" />}
                                Generate Report
                            </button>

                            <button
                                className="flex-1 sm:flex-none px-3 py-2 text-xs bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium flex items-center justify-center shadow-sm transition-all duration-150"
                                onClick={exportToCsv}
                                disabled={Object.values(monthlyData).length === 0}
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
                                            <PeriodStatusBadge isOpen={periodStatuses[month]} size="sm" />
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
                                                <FaRegFileAlt className="mx-auto mb-2 text-2xl opacity-30" />
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

// Set page title for MainLayout
LedgerSnapshots.pageTitle = "Ledger Balance Snapshots";