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
    FaExclamationCircle
} from 'react-icons/fa';
import API_CONFIG from '../config';
import Layout from '../components/Layout';

export default function MonthlyReports() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [monthlyBalances, setMonthlyBalances] = useState([]);
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

    return (
        <Layout>
            <div className="container mx-auto px-4 py-6">
                <h1 className="text-2xl font-semibold mb-6 flex items-center">
                    <FaFileAlt className="mr-2" /> Monthly Ledger Reports
                </h1>

                <div className="bg-white rounded-lg shadow-md mb-6 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                        {/* Month selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Month
                            </label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                        {monthlyBalances.length > 0 ? (
                            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                <div className="px-4 py-4 bg-gray-50 flex justify-between items-center">
                                    <h2 className="text-lg font-medium text-gray-900 flex items-center">
                                        <FaCalendarAlt className="mr-2" />
                                        Monthly Report - {getMonthName(selectedMonth)} {selectedYear}
                                    </h2>
                                    <button
                                        className="bg-green-600 text-white py-1 px-3 rounded-md flex items-center hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                        onClick={exportToCsv}
                                    >
                                        <FaDownload className="mr-1" /> Export CSV
                                    </button>
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
                                            {monthlyBalances.map((balance) => (
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
                        ) : (
                            selectedAccountId && (
                                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                                    <FaFileAlt className="mx-auto mb-3 text-4xl" />
                                    <p>No monthly data found for the selected period</p>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
} 