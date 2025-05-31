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
    FaListAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationTriangle,
    FaMoneyCheck,
    FaInfoCircle
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
    const [activeTab, setActiveTab] = useState('completed');
    const [pendingTotal, setPendingTotal] = useState(0);
    const [cancelledTotal, setCancelledTotal] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [cancelledCount, setCancelledCount] = useState(0);

    // New state for cheque type filter within tabs
    const [chequeTypeFilter, setChequeTypeFilter] = useState('all');
    const [pendingDebitCount, setPendingDebitCount] = useState(0);
    const [pendingCreditCount, setPendingCreditCount] = useState(0);
    const [cancelledDebitCount, setCancelledDebitCount] = useState(0);
    const [cancelledCreditCount, setCancelledCreditCount] = useState(0);

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
        end_date: '',
        status: 'completed' // Default to completed transactions
    });

    // Tab definitions
    const tabs = [
        {
            id: 'completed',
            label: 'Completed',
            status: 'completed',
            icon: <FaCheckCircle className="mr-1" />,
            description: 'Showing completed transactions including cleared cheques and regular transactions'
        },
        {
            id: 'pending',
            label: 'Pending Cheques',
            status: 'pending',
            icon: <FaClock className="mr-1" />,
            description: 'Showing pending cheques that have not been cleared or cancelled yet'
        },
        {
            id: 'cancelled',
            label: 'Cancelled Cheques',
            status: 'cancelled',
            icon: <FaTimesCircle className="mr-1" />,
            description: 'Showing cancelled cheques that were voided before clearing'
        }
    ];

    // Cheque type filter options
    const chequeTypeOptions = [
        { value: 'all', label: 'All Cheques' },
        { value: 'debit', label: 'Debit Cheques' },
        { value: 'credit', label: 'Credit Cheques' }
    ];

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Handle tab change
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setChequeTypeFilter('all'); // Reset cheque type filter when changing tabs
        setPage(1); // Reset to first page

        // Update filters based on tab
        let newFilters = {
            // Preserve these filters when switching tabs
            account_id: filters.account_id,
            ledger_head_id: filters.ledger_head_id,
            donor_id: filters.donor_id,
            start_date: filters.start_date,
            end_date: filters.end_date,

            // Reset these filters
            tx_type: '',
            cash_type: '',
            status: ''
        };

        // Apply tab-specific filters
        if (tabId === 'pending') {
            newFilters.status = 'pending';
            // No need to set cash_type, the backend will handle this
        } else if (tabId === 'cancelled') {
            newFilters.status = 'cancelled';
            // No need to set cash_type, the backend will handle this
        } else if (tabId === 'completed') {
            newFilters.status = 'completed';
        }

        // Set the new filters and force a refresh
        setFilters(newFilters);
    };

    // Handle cheque type filter change
    const handleChequeTypeChange = (value) => {
        setChequeTypeFilter(value);

        // Apply the transaction type filter while preserving other filters
        let updatedFilters = { ...filters };

        // Only set tx_type if a specific type is selected
        if (value === 'all') {
            updatedFilters.tx_type = '';
        } else {
            updatedFilters.tx_type = value;
        }

        setFilters(updatedFilters);
        setPage(1); // Reset to first page when filter changes
    };

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

                // Update the counts and totals for different tabs
                if (response.data.pendingTotal !== undefined) {
                    setPendingTotal(parseFloat(response.data.pendingTotal) || 0);
                }

                if (response.data.cancelledTotal !== undefined) {
                    setCancelledTotal(parseFloat(response.data.cancelledTotal) || 0);
                }

                // Set the counts
                setPendingCount(response.data.pendingCount || 0);
                setCancelledCount(response.data.cancelledCount || 0);

                // Set the debit/credit counts
                setPendingDebitCount(response.data.pendingDebitCount || 0);
                setPendingCreditCount(response.data.pendingCreditCount || 0);
                setCancelledDebitCount(response.data.cancelledDebitCount || 0);
                setCancelledCreditCount(response.data.cancelledCreditCount || 0);
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

    // Clear all filters (except status which is controlled by tabs)
    const clearFilters = () => {
        setFilters(prev => ({
            account_id: '',
            ledger_head_id: '',
            donor_id: '',
            tx_type: '',
            cash_type: activeTab === 'completed' ? '' : 'cheque',
            start_date: '',
            end_date: '',
            status: prev.status // Maintain the current status based on active tab
        }));
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
        if (!dateString) return "—";
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

        // Don't allow editing of pending or cleared cheques
        if (transaction.cheque && (transaction.cheque.status === 'pending' || transaction.cheque.status === 'cleared')) {
            toast.error('Cannot edit a cheque transaction once it has been issued.', {
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

    // Render cash type with status badge for cheques
    const renderCashTypeWithStatus = (transaction) => {
        const { cash_type, status, cheque, tx_type } = transaction;

        // If it has a cheque record, show appropriate status badge
        if (cheque) {
            const txTypeInfo = {
                debit: {
                    icon: <FaArrowUp className="mr-1" />,
                    text: 'Outgoing',
                    bgColor: 'bg-red-100',
                    textColor: 'text-red-800',
                    borderColor: 'border-red-200',
                },
                credit: {
                    icon: <FaArrowDown className="mr-1" />,
                    text: 'Incoming',
                    bgColor: 'bg-green-100',
                    textColor: 'text-green-800',
                    borderColor: 'border-green-200',
                }
            };

            const statusInfo = {
                pending: {
                    bgColor: 'bg-yellow-100',
                    textColor: 'text-yellow-800',
                    borderColor: 'border-yellow-200',
                    icon: <FaClock className="mr-1" />,
                    text: 'Pending Cheque',
                    tooltip: 'Pending Cheque – funds not deducted until cleared'
                },
                cleared: {
                    bgColor: 'bg-green-100',
                    textColor: 'text-green-800',
                    borderColor: 'border-green-200',
                    icon: <FaCheckCircle className="mr-1" />,
                    text: 'Cleared Cheque',
                    tooltip: 'Cleared Cheque – transaction completed'
                },
                cancelled: {
                    bgColor: 'bg-gray-100',
                    textColor: 'text-gray-800',
                    borderColor: 'border-gray-200',
                    icon: <FaTimesCircle className="mr-1" />,
                    text: 'Cancelled Cheque',
                    tooltip: 'Cancelled Cheque – transaction voided'
                }
            };

            const { bgColor, textColor, borderColor, icon, text, tooltip } = statusInfo[cheque.status] || statusInfo.pending;
            const txTypeDisplay = txTypeInfo[tx_type] || txTypeInfo.debit;

            return (
                <div className="flex flex-col space-y-1">
                    {renderCashType(cash_type)}
                    <div
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} border ${borderColor} shadow-sm`}
                        title={tooltip}
                    >
                        {icon}
                        {text}
                    </div>
                    <div
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${txTypeDisplay.bgColor} ${txTypeDisplay.textColor} border ${txTypeDisplay.borderColor} shadow-sm`}
                    >
                        {txTypeDisplay.icon}
                        {txTypeDisplay.text} Cheque
                    </div>
                </div>
            );
        }

        // Regular transaction - just show payment method
        return renderCashType(cash_type);
    };

    // Render transaction row with status-based styling
    const renderTransactionRow = (transaction) => {
        const isPending = transaction.status === 'pending' || (transaction.cheque && transaction.cheque.status === 'pending');
        const isCancelled = transaction.status === 'cancelled' || (transaction.cheque && transaction.cheque.status === 'cancelled');

        let rowClass = 'hover:bg-gray-50';
        if (isPending) {
            rowClass = 'bg-amber-50 hover:bg-amber-100';
        } else if (isCancelled) {
            rowClass = 'bg-gray-50 hover:bg-gray-100 text-gray-500';
        }

        // Style amount text based on status
        const getAmountStyle = () => {
            if (transaction.cash_type === 'cheque' || transaction.cheque) {
                if (transaction.status === 'pending' || (transaction.cheque && transaction.cheque.status === 'pending')) {
                    return 'text-amber-600 font-medium'; // Amber for pending cheques
                } else if (transaction.status === 'cancelled' || (transaction.cheque && transaction.cheque.status === 'cancelled')) {
                    return 'text-gray-400 line-through'; // Strike-through for cancelled cheques
                } else if (transaction.cash_type === 'cheque' && (!transaction.cheque || transaction.cheque.status === 'cleared')) {
                    return transaction.tx_type === 'credit' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'; // Normal colors for cleared cheques
                }
            }
            return transaction.tx_type === 'credit' ? 'text-green-600 font-medium' : 'text-red-600 font-medium';
        };

        return (
            <tr key={transaction.id} className={`${rowClass} transition duration-150`}>
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
                <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.booklet && transaction.receipt_no ? (
                        <div className="flex items-center">
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-md text-xs font-medium border border-blue-200 shadow-sm">
                                {transaction.booklet.prefix}{transaction.receipt_no.toString().padStart(transaction.booklet.digit_length, '0')}
                            </span>
                        </div>
                    ) : (
                        <span className="text-gray-400">—</span>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={`${getAmountStyle()}`}>
                        {formatCurrency(transaction.amount)}
                    </span>
                    {isPending && transaction.cheque && (
                        <div className="text-xs text-amber-700 mt-1">
                            Not deducted yet
                        </div>
                    )}
                    {isCancelled && transaction.cheque && (
                        <div className="text-xs text-gray-500 mt-1">
                            Cancelled - no deduction
                        </div>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.cheque ? (
                        <div className="text-sm">{transaction.cheque.cheque_number}</div>
                    ) : (
                        <span className="text-gray-400">—</span>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.cheque ? (
                        <div className="text-sm">{formatDate(transaction.cheque.due_date)}</div>
                    ) : (
                        <span className="text-gray-400">—</span>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {renderCashTypeWithStatus(transaction)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => onViewTransaction(transaction)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                        >
                            <FaEye />
                        </button>
                        {/* Only show edit for credit transactions that are not cheques or cancelled cheques */}
                        {transaction.tx_type === 'credit' &&
                            (!transaction.cheque ||
                                (transaction.cheque && transaction.cheque.status === 'cancelled')) && (
                                <button
                                    onClick={() => onEditTransaction(transaction)}
                                    className="text-indigo-600 hover:text-indigo-900"
                                    title="Edit Transaction"
                                >
                                    <FaEdit />
                                </button>
                            )}
                        {/* Only show delete for non-cheque transactions or cancelled cheques */}
                        {(!transaction.cheque ||
                            (transaction.cheque && transaction.cheque.status === 'cancelled')) && (
                                <button
                                    onClick={() => setConfirmDeleteId(transaction.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Transaction"
                                >
                                    <FaTrash />
                                </button>
                            )}
                    </div>
                </td>
            </tr>
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

    // Get tab description based on active tab
    const getTabDescription = () => {
        const tab = tabs.find(t => t.id === activeTab);
        return tab?.description || '';
    };

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-y-4">
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

            {/* Transaction Status Tabs */}
            <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-2" aria-label="Transaction Status">
                    {tabs.map((tab) => {
                        let tabCount = 0;
                        let badgeClass = '';

                        if (tab.id === 'pending') {
                            tabCount = pendingCount;
                            badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                        } else if (tab.id === 'cancelled') {
                            tabCount = cancelledCount;
                            badgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
                        }

                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`${activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm flex items-center`}
                                aria-current={activeTab === tab.id ? 'page' : undefined}
                            >
                                {tab.icon}
                                {tab.label}
                                {(tab.id === 'pending' || tab.id === 'cancelled') && (
                                    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full border ${badgeClass}`}>
                                        {tabCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab description */}
            <div className="text-sm text-gray-600 mb-4">
                {getTabDescription()}
            </div>

            {/* Cheque Type Filter - Only show for pending and cancelled tabs */}
            {(activeTab === 'pending' || activeTab === 'cancelled') && (
                <div className="mb-4 bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex flex-wrap items-center">
                        <span className="text-sm font-medium text-gray-700 mr-3">Filter cheque type:</span>
                        <div className="flex bg-gray-100 rounded-md p-0.5">
                            {chequeTypeOptions.map(option => (
                                <button
                                    key={option.value}
                                    className={`px-3 py-1 rounded text-sm font-medium ${chequeTypeFilter === option.value
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-700 hover:bg-gray-200'
                                        } transition-colors duration-150 ease-in-out`}
                                    onClick={() => handleChequeTypeChange(option.value)}
                                >
                                    {option.label}
                                    {option.value === 'debit' && activeTab === 'pending' && pendingDebitCount > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-200 text-indigo-800 text-xs rounded-full">{pendingDebitCount}</span>
                                    )}
                                    {option.value === 'credit' && activeTab === 'pending' && pendingCreditCount > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-200 text-indigo-800 text-xs rounded-full">{pendingCreditCount}</span>
                                    )}
                                    {option.value === 'debit' && activeTab === 'cancelled' && cancelledDebitCount > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-200 text-indigo-800 text-xs rounded-full">{cancelledDebitCount}</span>
                                    )}
                                    {option.value === 'credit' && activeTab === 'cancelled' && cancelledCreditCount > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-200 text-indigo-800 text-xs rounded-full">{cancelledCreditCount}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab specific information banners */}
            {activeTab === 'pending' && pendingTotal > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm flex items-center">
                    <FaInfoCircle className="text-amber-500 mr-2 flex-shrink-0" />
                    <div>
                        <span className="font-medium">Pending cheques total: </span>
                        {formatCurrency(pendingTotal)}
                        <span className="ml-2 text-amber-600">These amounts are not yet deducted from the bank balance.</span>
                        {filters.tx_type && (
                            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-xs font-medium border border-amber-200">
                                Showing only {filters.tx_type === 'debit' ? 'outgoing' : 'incoming'} cheques
                            </span>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'cancelled' && cancelledTotal > 0 && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm flex items-center">
                    <FaInfoCircle className="text-gray-500 mr-2 flex-shrink-0" />
                    <div>
                        <span className="font-medium">Cancelled cheques value: </span>
                        {formatCurrency(cancelledTotal)}
                        <span className="ml-2 text-gray-600">These transactions have been cancelled and had no effect on balances.</span>
                        {filters.tx_type && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 rounded-md text-xs font-medium border border-gray-200">
                                Showing only {filters.tx_type === 'debit' ? 'outgoing' : 'incoming'} cheques
                            </span>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'completed' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center">
                    <FaInfoCircle className="text-blue-500 mr-2 flex-shrink-0" />
                    <div>
                        <span>Showing completed transactions, including cleared cheques and regular debits/credits.</span>
                    </div>
                </div>
            )}

            {/* Filters form */}
            {showFilters && (
                <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <FaFilter className="mr-2 text-indigo-500" />
                        Transaction Filters
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                            <select
                                name="account_id"
                                value={filters.account_id}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Accounts</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ledger Head</label>
                            <select
                                name="ledger_head_id"
                                value={filters.ledger_head_id}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Ledger Heads</option>
                                {ledgerHeads.map(ledgerHead => (
                                    <option key={ledgerHead.id} value={ledgerHead.id}>
                                        {ledgerHead.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Donor</label>
                            <select
                                name="donor_id"
                                value={filters.donor_id}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Donors</option>
                                {donors.map(donor => (
                                    <option key={donor.id} value={donor.id}>
                                        {donor.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                            <select
                                name="tx_type"
                                value={filters.tx_type}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Types</option>
                                <option value="credit">Credit (Income)</option>
                                <option value="debit">Debit (Expense)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                            <select
                                name="cash_type"
                                value={filters.cash_type}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Methods</option>
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                                <option value="netbank">Net Banking</option>
                                <option value="multiple">Both (Cash & Bank)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                name="status"
                                value={filters.status}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Statuses</option>
                                <option value="completed">Completed</option>
                                <option value="pending">Pending</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                            <input
                                type="date"
                                name="start_date"
                                value={filters.start_date}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                            <input
                                type="date"
                                name="end_date"
                                value={filters.end_date}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end mt-4">
                        <button
                            onClick={clearFilters}
                            className="mr-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <FaTimes className="mr-1.5 inline" />
                            Clear Filters
                        </button>
                        <button
                            onClick={fetchTransactions}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <FaSearch className="mr-1.5 inline" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

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
                                    Cheque #
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Due Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Payment
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.length > 0 ? (
                                transactions.map(transaction => renderTransactionRow(transaction))
                            ) : (
                                <tr>
                                    <td colSpan="9" className="px-6 py-10 text-center text-gray-500">
                                        {loading ? (
                                            <div className="flex justify-center items-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
                                                Loading transactions...
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <FaTable className="text-4xl text-gray-300 mb-3" />
                                                <p className="text-lg">No transactions found</p>
                                                <p className="text-sm mt-1">Try adjusting your filters or creating a new transaction</p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination controls */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
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
            </div>

            {/* Delete confirmation modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setConfirmDeleteId(null)}></div>
                    <div className="relative bg-white rounded-lg max-w-md w-full mx-auto shadow-xl z-10 p-6">
                        <div className="text-center">
                            <FaExclamationTriangle className="mx-auto text-yellow-500 text-5xl mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Transaction Deletion</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Are you sure you want to void this transaction? This action cannot be undone.
                                This will reverse all balance changes that were made by this transaction.
                            </p>
                            <div className="flex justify-center space-x-3">
                                <button
                                    type="button"
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md focus:outline-none"
                                    onClick={() => setConfirmDeleteId(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md focus:outline-none"
                                    onClick={() => {
                                        // Handle delete
                                        // For now just close the modal
                                        setConfirmDeleteId(null);
                                    }}
                                >
                                    Yes, Void Transaction
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 