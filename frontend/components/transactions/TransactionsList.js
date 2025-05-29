import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaSearch,
    FaFilter,
    FaSync,
    FaTimes,
    FaEye,
    FaTrash,
    FaArrowUp,
    FaArrowDown,
    FaMoneyBillWave,
    FaCreditCard,
    FaMobileAlt,
    FaUniversity,
    FaFileInvoice,
    FaCalendarAlt,
    FaClock,
    FaTable,
    FaEdit,
    FaListAlt
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

export default function TransactionsList({ onViewTransaction, onEditTransaction }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [limit, setLimit] = useState(10);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // Options for filters
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [donors, setDonors] = useState([]);

    // Filter state
    const [filters, setFilters] = useState({
        account_id: '',
        ledger_head_id: '',
        donor_id: '',
        tx_type: '',
        cash_type: '',
        start_date: '',
        end_date: ''
    });

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch transactions with filters and pagination
    const fetchTransactions = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query parameters
            let params = { page, limit };

            // Add filters to params if they exist
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params[key] = filters[key];
                }
            });

            const response = await api.get('/api/transactions', { params });

            if (response.data && response.data.success) {
                setTransactions(response.data.transactions || []);
                setTotalPages(response.data.totalPages || 1);
                setTotalTransactions(response.data.total || 0);
            } else {
                setTransactions([]);
                console.warn('Unexpected API response format:', response.data);
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);

            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                setError(`Failed to fetch transactions. Server responded with: ${err.response.status} ${err.response.statusText}`);
            } else {
                setError(`Failed to fetch transactions: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch filter options (accounts, ledger heads, donors)
    const fetchFilterOptions = async () => {
        try {
            const [accountsRes, ledgerHeadsRes, donorsRes] = await Promise.all([
                api.get('/api/accounts'),
                api.get('/api/ledger-heads'),
                api.get('/api/donors')
            ]);

            setAccounts(accountsRes.data.data || []);
            setLedgerHeads(ledgerHeadsRes.data.data || []);
            setDonors(donorsRes.data.data || []);
        } catch (err) {
            console.error('Error fetching filter options:', err);
        }
    };

    // Load transactions and filter options on component mount
    useEffect(() => {
        fetchTransactions();
        fetchFilterOptions();
    }, [page, limit]);

    // Reload transactions when filters change
    useEffect(() => {
        setPage(1); // Reset to first page when filters change
        fetchTransactions();
    }, [filters]);

    // Handle filter changes
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            account_id: '',
            ledger_head_id: '',
            donor_id: '',
            tx_type: '',
            cash_type: '',
            start_date: '',
            end_date: ''
        });
    };

    // Format currency amounts with Indian Rupee symbol
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Format date as DD/MM/YYYY
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    // View transaction details
    const handleViewTransaction = (transaction) => {
        console.log('View transaction clicked:', transaction);

        // Make sure we have a valid transaction object
        if (!transaction || !transaction.id) {
            console.error('Invalid transaction object:', transaction);
            toast.error('Cannot view transaction: Invalid transaction data', {
                position: "top-right",
                autoClose: 3000
            });
            return;
        }

        if (onViewTransaction) {
            onViewTransaction(transaction);
        }
    };

    // Edit transaction
    const handleEditTransaction = (transaction) => {
        console.log('Edit transaction clicked:', transaction);

        // Make sure we have a valid transaction object
        if (!transaction || !transaction.id) {
            console.error('Invalid transaction object:', transaction);
            toast.error('Cannot edit transaction: Invalid transaction data', {
                position: "top-right",
                autoClose: 3000
            });
            return;
        }

        if (onEditTransaction) {
            onEditTransaction(transaction);
        }
    };

    // Delete transaction
    const handleDelete = async (id) => {
        try {
            setLoading(true);

            const response = await api.delete(`/api/transactions/${id}`);

            if (response.data && response.data.success) {
                // Refresh the transactions list
                fetchTransactions();
                setConfirmDeleteId(null);
                toast.success('Transaction voided successfully', {
                    position: "top-right",
                    autoClose: 3000
                });
            } else {
                console.warn('Unexpected API response format:', response.data);
                toast.error('Failed to void transaction.', {
                    position: "top-right",
                    autoClose: 3000
                });
            }
        } catch (err) {
            console.error('Error voiding transaction:', err);
            toast.error(`Error voiding transaction: ${err.message}`, {
                position: "top-right",
                autoClose: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    // Render transaction type badge
    const renderTransactionType = (txType) => {
        if (txType === 'credit') {
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 shadow-sm">
                    <FaArrowDown className="mr-1.5 text-green-600" />
                    Credit
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 shadow-sm">
                    <FaArrowUp className="mr-1.5 text-red-600" />
                    Debit
                </span>
            );
        }
    };

    // Render cash type badge
    const renderCashType = (cashType) => {
        let icon;
        let colorClass;
        let labelText;

        switch (cashType) {
            case 'cash':
                icon = <FaMoneyBillWave className="mr-1.5" />;
                colorClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                labelText = 'Cash';
                break;
            case 'bank':
                icon = <FaUniversity className="mr-1.5" />;
                colorClass = 'bg-blue-100 text-blue-800 border border-blue-200';
                labelText = 'Bank';
                break;
            case 'upi':
                icon = <FaMobileAlt className="mr-1.5" />;
                colorClass = 'bg-purple-100 text-purple-800 border border-purple-200';
                labelText = 'UPI';
                break;
            case 'card':
                icon = <FaCreditCard className="mr-1.5" />;
                colorClass = 'bg-indigo-100 text-indigo-800 border border-indigo-200';
                labelText = 'Card';
                break;
            case 'netbank':
                icon = <FaUniversity className="mr-1.5" />;
                colorClass = 'bg-cyan-100 text-cyan-800 border border-cyan-200';
                labelText = 'NetBank';
                break;
            case 'cheque':
                icon = <FaFileInvoice className="mr-1.5" />;
                colorClass = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
                labelText = 'Cheque';
                break;
            case 'multiple':
                icon = <FaMoneyBillWave className="mr-1.5" />;
                colorClass = 'bg-gray-100 text-gray-800 border border-gray-200';
                labelText = 'Multiple';
                break;
            default:
                icon = <FaMoneyBillWave className="mr-1.5" />;
                colorClass = 'bg-gray-100 text-gray-800 border border-gray-200';
                labelText = cashType.charAt(0).toUpperCase() + cashType.slice(1);
        }

        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClass} shadow-sm`}>
                {icon}
                {labelText}
            </span>
        );
    };

    // Render pagination controls
    const renderPagination = () => (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 text-gray-600 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="mb-3 sm:mb-0 text-sm">
                Showing <span className="font-medium">{transactions.length > 0 ? ((page - 1) * limit) + 1 : 0}-{Math.min(page * limit, totalTransactions)}</span> of <span className="font-medium">{totalTransactions}</span> transactions
            </div>

            <div className="flex items-center">
                <span className="mr-3 text-sm">Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span></span>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <button
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed border-r border-gray-200 flex items-center"
                        onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                        disabled={page === 1 || loading}
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Prev
                    </button>
                    <button
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={page >= totalPages || loading}
                    >
                        Next
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
                <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="ml-3 bg-white border border-gray-200 rounded-lg text-gray-700 px-2 py-1.5 shadow-sm text-sm"
                    disabled={loading}
                >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                </select>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Error message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start shadow-sm">
                    <div className="flex-1">
                        <h3 className="font-bold mb-1 flex items-center">
                            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Error
                        </h3>
                        <p className="text-sm">{error}</p>
                    </div>
                    <button
                        onClick={fetchTransactions}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded-lg text-red-700 text-sm font-medium flex items-center shadow-sm transition duration-150"
                    >
                        <FaSync className="mr-1.5" />
                        Retry
                    </button>
                </div>
            )}

            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-y-4">
                <h1 className="text-xl font-bold text-gray-800 flex items-center">
                    <FaListAlt className="mr-2 text-indigo-500" />
                    Transactions List
                </h1>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium shadow-sm">
                        {totalTransactions} Transactions
                    </span>
                    <button
                        className={`px-4 py-2 rounded-lg text-white flex items-center font-medium transition duration-150 ${showFilters ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-500 hover:bg-gray-600'} shadow-sm`}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FaFilter className="mr-1.5" />
                        Filters
                    </button>
                    <button
                        className="px-4 py-2 bg-white hover:bg-gray-50 rounded-lg text-gray-700 flex items-center border border-gray-200 font-medium shadow-sm transition duration-150"
                        onClick={fetchTransactions}
                        disabled={loading}
                    >
                        <FaSync className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters form */}
            {showFilters && (
                <div className="bg-white p-5 rounded-lg mb-6 shadow-md border border-gray-100">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                        <h3 className="text-lg font-medium text-gray-800 flex items-center">
                            <FaFilter className="mr-2 text-indigo-500" />
                            Filter Transactions
                        </h3>
                        <button
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition duration-150"
                            onClick={() => setShowFilters(false)}
                        >
                            <FaTimes />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Account Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account</label>
                            <select
                                name="account_id"
                                value={filters.account_id}
                                onChange={handleFilterChange}
                                className="bg-white text-gray-700 border border-gray-200 rounded-lg p-2.5 w-full shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                            >
                                <option value="">All Accounts</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Transaction Type Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction Type</label>
                            <select
                                name="tx_type"
                                value={filters.tx_type}
                                onChange={handleFilterChange}
                                className="bg-white text-gray-700 border border-gray-200 rounded-lg p-2.5 w-full shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                            >
                                <option value="">All Types</option>
                                <option value="credit">Credit</option>
                                <option value="debit">Debit</option>
                            </select>
                        </div>

                        {/* Payment Method Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
                            <select
                                name="cash_type"
                                value={filters.cash_type}
                                onChange={handleFilterChange}
                                className="bg-white text-gray-700 border border-gray-200 rounded-lg p-2.5 w-full shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                            >
                                <option value="">All Methods</option>
                                <option value="cash">Cash</option>
                                <option value="bank">Bank Transfer</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card Payment</option>
                                <option value="netbank">Net Banking</option>
                                <option value="cheque">Cheque</option>
                                <option value="multiple">Multiple</option>
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="date"
                                        name="start_date"
                                        value={filters.start_date}
                                        onChange={handleFilterChange}
                                        className="pl-10 bg-white text-gray-700 border border-gray-200 rounded-lg p-2.5 w-full shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="date"
                                        name="end_date"
                                        value={filters.end_date}
                                        onChange={handleFilterChange}
                                        className="pl-10 bg-white text-gray-700 border border-gray-200 rounded-lg p-2.5 w-full shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                        <button
                            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium flex items-center shadow-sm transition duration-150"
                            onClick={clearFilters}
                        >
                            <FaTimes className="mr-1.5" />
                            Clear Filters
                        </button>
                        <button
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium flex items-center shadow-sm transition duration-150"
                            onClick={fetchTransactions}
                        >
                            <FaSearch className="mr-1.5" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Transactions table */}
            <div className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Account / Ledger
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Receipt
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Amount
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Payment
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading && transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500 bg-gray-50">
                                        <div className="flex justify-center items-center space-x-3">
                                            <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Loading transactions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500 bg-gray-50">
                                        <div className="flex flex-col items-center justify-center">
                                            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-sm">No transactions found</p>
                                            <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or adding new transactions</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(transaction => (
                                    <tr key={transaction.id} className="hover:bg-gray-50 transition duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                                            {formatDate(transaction.tx_date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {renderTransactionType(transaction.tx_type)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-700">{transaction.account?.name || 'Unknown Account'}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {transaction.ledgerHead?.name || 'Multiple Ledger Heads'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {transaction.receipt_no ? (
                                                <div>
                                                    <div className="text-sm font-medium text-gray-700">#{transaction.receipt_no}</div>
                                                    {transaction.booklet ? (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Booklet: {transaction.booklet.booklet_no || transaction.booklet.name}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-500 mt-1 italic">
                                                            (detached from booklet)
                                                        </div>
                                                    )}
                                                </div>
                                            ) : transaction.tx_type === 'credit' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    No Receipt
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-sm font-bold ${transaction.tx_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                                ₹{parseFloat(transaction.amount).toLocaleString('en-IN', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {renderCashType(transaction.cash_type)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                                            {confirmDeleteId === transaction.id ? (
                                                <div className="flex items-center justify-end space-x-3">
                                                    <button
                                                        className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:text-gray-900 transition-all duration-150 shadow-sm hover:shadow"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-800 text-sm font-medium rounded-lg border border-red-300 hover:border-red-400 transition-all duration-150 shadow-sm hover:shadow"
                                                        onClick={() => handleDelete(transaction.id)}
                                                    >
                                                        Confirm
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end space-x-3">
                                                    <button
                                                        className="p-1.5 bg-blue-50 hover:bg-blue-200 rounded-lg text-blue-600 hover:text-blue-800 transition-all duration-150 border border-blue-200 hover:border-blue-400 shadow-sm hover:shadow transform hover:scale-110"
                                                        onClick={() => handleViewTransaction(transaction)}
                                                        title="View details"
                                                    >
                                                        <FaEye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="p-1.5 bg-green-50 hover:bg-green-200 rounded-lg text-green-600 hover:text-green-800 transition-all duration-150 border border-green-200 hover:border-green-400 shadow-sm hover:shadow transform hover:scale-110"
                                                        onClick={() => handleEditTransaction(transaction)}
                                                        title="Edit transaction"
                                                    >
                                                        <FaEdit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="p-1.5 bg-red-50 hover:bg-red-200 rounded-lg text-red-600 hover:text-red-800 transition-all duration-150 border border-red-200 hover:border-red-400 shadow-sm hover:shadow transform hover:scale-110"
                                                        onClick={() => setConfirmDeleteId(transaction.id)}
                                                        title="Void transaction"
                                                    >
                                                        <FaTrash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {transactions.length > 0 && renderPagination()}
            </div>
        </div>
    );
} 