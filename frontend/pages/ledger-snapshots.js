import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    FaChartLine,
    FaCalendarAlt,
    FaDownload,
    FaLock,
    FaUnlock,
    FaRegMoneyBillAlt,
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
    FaAngleDown,
    FaBuilding,
    FaUsers,
    FaTags,
    FaExclamationCircle
} from 'react-icons/fa';
import API_CONFIG from '../config';

export default function LedgerSnapshots() {
    const [allAccountsData, setAllAccountsData] = useState({});
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedMonths, setExpandedMonths] = useState({});
    const [expandedAccounts, setExpandedAccounts] = useState({});
    const [periodStatuses, setPeriodStatuses] = useState({});
    const [activeFilter, setActiveFilter] = useState('all');
    const [systemTotals, setSystemTotals] = useState({
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

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    useEffect(() => {
        fetchAllAccountsData();
    }, [selectedYear]);

    useEffect(() => {
        calculateSystemTotals();
    }, [allAccountsData]);

    // Toggle month expansion
    const toggleMonth = (month) => {
        setExpandedMonths(prev => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    // Toggle account expansion
    const toggleAccount = (accountId) => {
        setExpandedAccounts(prev => ({
            ...prev,
            [accountId]: !prev[accountId]
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

    // Fetch data for all accounts
    const fetchAllAccountsData = async () => {
        try {
            setLoading(true);
            setError(null);

            // First get all accounts
            const accountsResponse = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/accounts`);
            
            if (!accountsResponse.data.success) {
                throw new Error('Failed to fetch accounts');
            }

            const accounts = accountsResponse.data.data;
            const allData = {};

            // Fetch data for each account
            for (const account of accounts) {
                console.log(`Fetching data for account: ${account.name} (ID: ${account.id})`);
                
                try {
                    // Fetch monthly data for this account
                    const monthlyResponse = await axios.get(
                        `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-ledger-balances`,
                        {
                            params: {
                                account_id: account.id,
                                year: selectedYear
                            }
                        }
                    );

                    // Fetch period statuses for this account
                    const periodResponse = await axios.get(
                        `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/periods/year-status`,
                        {
                            params: {
                                account_id: account.id,
                                year: selectedYear
                            }
                        }
                    );

                    if (monthlyResponse.data.success) {
                        allData[account.id] = {
                            account: account,
                            monthlyData: processMonthlyData(monthlyResponse.data.data || []),
                            periodStatuses: periodResponse.data.success ? periodResponse.data.data.periods : {}
                        };
                    }
                } catch (accountError) {
                    console.error(`Error fetching data for account ${account.name}:`, accountError);
                    // Continue with other accounts even if one fails
                    allData[account.id] = {
                        account: account,
                        monthlyData: {},
                        periodStatuses: {}
                    };
                }
            }

            setAllAccountsData(allData);
            
            // Auto-expand accounts that have data
            const newExpandedAccounts = {};
            Object.keys(allData).forEach(accountId => {
                const hasData = Object.keys(allData[accountId].monthlyData).length > 0;
                newExpandedAccounts[accountId] = hasData;
            });
            setExpandedAccounts(newExpandedAccounts);

        } catch (err) {
            console.error('Error fetching accounts data:', err);
            setError(err.response?.data?.message || err.message || 'An error occurred');
            toast.error('Error loading ledger snapshots');
        } finally {
            setLoading(false);
        }
    };

    // Process monthly data into organized structure
    const processMonthlyData = (rawData) => {
        const monthData = {};
        
        rawData.forEach(balance => {
            const month = balance.month;
            if (!monthData[month]) {
                monthData[month] = {
                    balances: [],
                    totals: { receipts: 0, payments: 0, balance: 0, cashInHand: 0, cashInBank: 0 }
                };
            }
            
            monthData[month].balances.push(balance);
            
            // Calculate totals
            monthData[month].totals.receipts += parseFloat(balance.receipts || 0);
            monthData[month].totals.payments += parseFloat(balance.payments || 0);
            monthData[month].totals.balance += parseFloat(balance.closing_balance || 0);
            monthData[month].totals.cashInHand += parseFloat(balance.cash_in_hand || 0);
            monthData[month].totals.cashInBank += parseFloat(balance.cash_in_bank || 0);
        });

        return monthData;
    };

    // Calculate system-wide totals
    const calculateSystemTotals = () => {
        let totals = {
            receipts: 0,
            payments: 0,
            balance: 0,
            cash: 0,
            bank: 0
        };

        Object.values(allAccountsData).forEach(accountData => {
            Object.values(accountData.monthlyData).forEach(month => {
                totals.receipts += month.totals.receipts;
                totals.payments += month.totals.payments;
                totals.balance += month.totals.balance;
                totals.cash += month.totals.cashInHand;
                totals.bank += month.totals.cashInBank;
            });
        });

        setSystemTotals(totals);
    };

    // Format currency values
    const formatCurrency = (amount) => {
        const value = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    // Get filtered months based on active filter
    const getFilteredMonths = () => {
        const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
        
        if (activeFilter === 'all') return allMonths;
        
        return allMonths.filter(month => {
            // Check if any account has this month in the desired state
            return Object.values(allAccountsData).some(accountData => {
                const isOpen = accountData.periodStatuses[month];
                return activeFilter === 'open' ? isOpen : !isOpen;
            });
        });
    };

    // Get month name
    const getMonthName = (month) => months[month - 1];

    // Export data to CSV
    const exportToCsv = () => {
        const csvContent = generateCsvContent();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `all_accounts_${selectedYear}_ledger_snapshots.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateCsvContent = () => {
        let csvContent = "Account,Month,Ledger Head,Type,Opening Balance,Receipts,Payments,Closing Balance,Cash In Hand,Cash In Bank\\n";
        
        Object.values(allAccountsData).forEach(accountData => {
            const accountName = accountData.account.name;
            Object.entries(accountData.monthlyData).forEach(([month, monthData]) => {
                const monthName = getMonthName(parseInt(month));
                monthData.balances.forEach(balance => {
                    csvContent += `${accountName},${monthName},${balance.ledgerHead?.name || 'Unknown'},${balance.ledgerHead?.head_type || 'Unknown'},${balance.opening_balance},${balance.receipts},${balance.payments},${balance.closing_balance},${balance.cash_in_hand},${balance.cash_in_bank}\\n`;
                });
            });
        });
        
        return csvContent;
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                            <FaChartLine className="mr-3 text-indigo-600" />
                            Ledger Balance Snapshots
                        </h1>
                        <p className="mt-1 text-gray-600">
                            Comprehensive view of all account balances across periods
                        </p>
                    </div>

                    <div className="flex items-center space-x-3 mt-4 md:mt-0">
                        {/* Export button */}
                        <button
                            onClick={exportToCsv}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            disabled={loading}
                        >
                            <FaFileDownload className="mr-2" />
                            Export CSV
                        </button>

                        {/* Refresh button */}
                        <button
                            onClick={fetchAllAccountsData}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            disabled={loading}
                        >
                            <FaSyncAlt className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Year filter */}
                <div className="mt-4">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                            <FaCalendarAlt className="mr-2 text-gray-500" />
                            <label className="text-sm font-medium text-gray-700 mr-3">Year:</label>
                            <div className="relative">
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            </div>

            {/* Filter tabs */}
            <div className="bg-white rounded-lg shadow mb-6">
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

            {/* System-wide Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-emerald-500 text-white rounded-lg shadow p-4">
                    <div className="text-sm opacity-80">TOTAL RECEIPTS</div>
                    <div className="text-2xl font-bold mt-1">{formatCurrency(systemTotals.receipts)}</div>
                    <div className="text-xs mt-2">All Accounts {selectedYear}</div>
                </div>
                <div className="bg-red-500 text-white rounded-lg shadow p-4">
                    <div className="text-sm opacity-80">TOTAL PAYMENTS</div>
                    <div className="text-2xl font-bold mt-1">{formatCurrency(systemTotals.payments)}</div>
                    <div className="text-xs mt-2">All Accounts {selectedYear}</div>
                </div>
                <div className="bg-indigo-600 text-white rounded-lg shadow p-4">
                    <div className="text-sm opacity-80">NET BALANCE</div>
                    <div className="text-2xl font-bold mt-1">{formatCurrency(systemTotals.balance)}</div>
                    <div className="text-xs mt-2">All Accounts {selectedYear}</div>
                </div>
                <div className="bg-blue-500 text-white rounded-lg shadow p-4">
                    <div className="text-sm opacity-80">TOTAL CASH</div>
                    <div className="text-2xl font-bold mt-1">{formatCurrency(systemTotals.cash)}</div>
                    <div className="text-xs mt-2">All Accounts Balance</div>
                </div>
                <div className="bg-blue-700 text-white rounded-lg shadow p-4">
                    <div className="text-sm opacity-80">TOTAL BANK</div>
                    <div className="text-2xl font-bold mt-1">{formatCurrency(systemTotals.bank)}</div>
                    <div className="text-xs mt-2">All Accounts Balance</div>
                </div>
            </div>

            {/* Loading state */}
            {loading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                    <div className="mt-4 text-gray-600">Loading all accounts data...</div>
                </div>
            ) : (
                <>
                    {/* Month accordions */}
                    {getFilteredMonths().map((month) => (
                        <div key={month} className="bg-white rounded-lg shadow overflow-hidden border border-gray-100 mb-4">
                            <div
                                className="p-4 cursor-pointer flex justify-between items-center bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200"
                                onClick={() => toggleMonth(month)}
                            >
                                <div className="flex items-center">
                                    {expandedMonths[month] ? (
                                        <FaAngleDown className="text-gray-500 mr-3" />
                                    ) : (
                                        <FaAngleRight className="text-gray-500 mr-3" />
                                    )}
                                    <span className="text-lg font-semibold text-gray-900">{getMonthName(month)} {selectedYear}</span>
                                </div>

                                <div className="flex space-x-6 text-sm">
                                    {/* Calculate month totals across all accounts */}
                                    {(() => {
                                        let monthTotals = { receipts: 0, payments: 0, balance: 0 };
                                        Object.values(allAccountsData).forEach(accountData => {
                                            if (accountData.monthlyData[month]) {
                                                monthTotals.receipts += accountData.monthlyData[month].totals.receipts;
                                                monthTotals.payments += accountData.monthlyData[month].totals.payments;
                                                monthTotals.balance += accountData.monthlyData[month].totals.balance;
                                            }
                                        });
                                        return (
                                            <>
                                                <div>
                                                    <span className="text-gray-500">Receipts</span>
                                                    <span className="ml-2 text-green-600 font-medium">
                                                        {formatCurrency(monthTotals.receipts)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Payments</span>
                                                    <span className="ml-2 text-red-600 font-medium">
                                                        {formatCurrency(monthTotals.payments)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Balance</span>
                                                    <span className="ml-2 text-gray-900 font-medium">
                                                        {formatCurrency(monthTotals.balance)}
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {expandedMonths[month] && (
                                <div className="p-0">
                                    {/* Accounts within this month */}
                                    {Object.values(allAccountsData).map(accountData => {
                                        const monthData = accountData.monthlyData[month];
                                        if (!monthData || monthData.balances.length === 0) {
                                            return null; // Skip accounts with no data for this month
                                        }

                                        return (
                                            <div key={accountData.account.id} className="border-b border-gray-100 last:border-b-0">
                                                {/* Account header */}
                                                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <FaBuilding className="text-indigo-600 mr-2" />
                                                            <span className="font-medium text-gray-900">{accountData.account.name}</span>
                                                            <div className="ml-3 px-2 py-1 bg-white rounded text-xs text-gray-600">
                                                                {monthData.balances.length} ledger heads
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex space-x-4 text-sm">
                                                            <div>
                                                                <span className="text-gray-500">Receipts</span>
                                                                <span className="ml-2 text-green-600 font-medium">
                                                                    {formatCurrency(monthData.totals.receipts)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">Balance</span>
                                                                <span className="ml-2 text-gray-900 font-medium">
                                                                    {formatCurrency(monthData.totals.balance)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Ledger heads table for this account */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-50">
                                                                <th className="border-r border-gray-200 text-center px-3 py-2 text-xs font-semibold text-gray-700" colSpan="4">
                                                                    CREDIT SIDE
                                                                </th>
                                                                <th className="border-r border-gray-200 text-center px-3 py-2 text-xs font-semibold text-gray-700" colSpan="2">
                                                                    DEBIT SIDE  
                                                                </th>
                                                                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700" colSpan="3">
                                                                    BALANCE
                                                                </th>
                                                            </tr>
                                                            <tr className="bg-gray-100 text-xs">
                                                                <th className="border-r border-gray-200 text-left px-3 py-2 font-medium text-gray-600">Ledger Head</th>
                                                                <th className="border-r border-gray-200 text-right px-3 py-2 font-medium text-gray-600">O.B</th>
                                                                <th className="border-r border-gray-200 text-right px-3 py-2 font-medium text-gray-600">Receipts</th>
                                                                <th className="border-r border-gray-200 text-right px-3 py-2 font-medium text-gray-600">C. Total</th>
                                                                <th className="border-r border-gray-200 text-left px-3 py-2 font-medium text-gray-600">Ledger Head</th>
                                                                <th className="border-r border-gray-200 text-right px-3 py-2 font-medium text-gray-600">Amount</th>
                                                                <th className="border-r border-gray-200 text-right px-3 py-2 font-medium text-gray-600">Balance</th>
                                                                <th className="border-r border-gray-200 text-right px-3 py-2 font-medium text-gray-600">Cash Bank</th>
                                                                <th className="text-right px-3 py-2 font-medium text-gray-600">Cash Hand</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(() => {
                                                                const creditHeads = monthData.balances.filter(balance => balance.ledgerHead?.head_type === 'credit');
                                                                const debitHeads = monthData.balances.filter(balance => balance.ledgerHead?.head_type === 'debit');
                                                                const maxRows = Math.max(creditHeads.length, debitHeads.length);
                                                                const rows = [];

                                                                for (let i = 0; i < maxRows; i++) {
                                                                    const creditHead = creditHeads[i] || null;
                                                                    const debitHead = debitHeads[i] || null;

                                                                    rows.push(
                                                                        <tr key={i} className={i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                                                                            {/* Credit Head Columns */}
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-sm">
                                                                                {creditHead ? (
                                                                                    <div className="flex items-center">
                                                                                        <FaTags className="text-green-500 mr-2 text-xs" />
                                                                                        {creditHead.ledgerHead?.name || 'Unknown'}
                                                                                    </div>
                                                                                ) : ''}
                                                                            </td>
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-right text-sm">
                                                                                {creditHead ? formatCurrency(creditHead.opening_balance) : ''}
                                                                            </td>
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-green-600 font-medium">
                                                                                {creditHead ? formatCurrency(creditHead.receipts) : ''}
                                                                            </td>
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-right text-sm font-semibold">
                                                                                {creditHead ? formatCurrency(parseFloat(creditHead.opening_balance || 0) + parseFloat(creditHead.receipts || 0)) : ''}
                                                                            </td>

                                                                            {/* Debit Head Columns */}
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-sm">
                                                                                {debitHead ? (
                                                                                    <div className="flex items-center">
                                                                                        <FaTags className="text-red-500 mr-2 text-xs" />
                                                                                        {debitHead.ledgerHead?.name || 'Unknown'}
                                                                                    </div>
                                                                                ) : ''}
                                                                            </td>
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-red-600 font-medium">
                                                                                {debitHead ? formatCurrency(parseFloat(debitHead.receipts || 0)) : ''}
                                                                            </td>

                                                                            {/* Balance Columns */}
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-right text-sm font-semibold">
                                                                                {creditHead ? formatCurrency(creditHead.closing_balance) : ''}
                                                                            </td>
                                                                            <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-blue-600">
                                                                                {creditHead ? formatCurrency(creditHead.cash_in_bank) : ''}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-right text-sm text-green-600">
                                                                                {creditHead ? formatCurrency(creditHead.cash_in_hand) : ''}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                return rows;
                                                            })()}
                                                        </tbody>

                                                        {/* Account totals row */}
                                                        <tfoot>
                                                            <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-semibold">
                                                                <td className="border-r border-gray-200 px-3 py-2 text-sm text-indigo-800">Total ({accountData.account.name})</td>
                                                                <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-indigo-800">
                                                                    {formatCurrency(monthData.balances.filter(b => b.ledgerHead?.head_type === 'credit').reduce((sum, b) => sum + parseFloat(b.opening_balance || 0), 0))}
                                                                </td>
                                                                <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-green-700 font-bold">
                                                                    {formatCurrency(monthData.totals.receipts)}
                                                                </td>
                                                                <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-indigo-800 font-bold">
                                                                    {formatCurrency(monthData.balances.filter(b => b.ledgerHead?.head_type === 'credit').reduce((sum, b) => sum + parseFloat(b.opening_balance || 0) + parseFloat(b.receipts || 0), 0))}
                                                                </td>
                                                                <td className="border-r border-gray-200 px-3 py-2 text-sm text-indigo-800">Total</td>
                                                                <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-red-700 font-bold">
                                                                    {formatCurrency(monthData.totals.payments)}
                                                                </td>
                                                                <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-indigo-800 font-bold">
                                                                    {formatCurrency(monthData.totals.balance)}
                                                                </td>
                                                                <td className="border-r border-gray-200 px-3 py-2 text-right text-sm text-blue-700 font-bold">
                                                                    {formatCurrency(monthData.totals.cashInBank)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-sm text-green-700 font-bold">
                                                                    {formatCurrency(monthData.totals.cashInHand)}
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}

            {/* Error state */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <FaExclamationCircle className="text-red-500 mr-2" />
                        <span className="text-red-700">{error}</span>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && Object.keys(allAccountsData).length === 0 && !error && (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <FaChartLine className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        No ledger snapshots found for the selected year.
                    </p>
                </div>
            )}
        </div>
    );
}