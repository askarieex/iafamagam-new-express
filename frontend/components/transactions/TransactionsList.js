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
    FaInfoCircle,
    FaExchangeAlt,
    FaShieldAlt,
    FaLock
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

            // Use the new immutable transaction system endpoint
            const response = await api.get('/api/transactions/history', {
                params,
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.data && response.data.success) {
                // Handle new immutable transaction system data structure
                setTransactions(response.data.data || []);
                setTotalPages(1); // Update if pagination is implemented in new system
                setTotalTransactions(response.data.count || 0);

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
            case 'mixed':
            case 'both':
                icon = (
                    <div className="flex -space-x-0.5">
                        <FaMoneyBillWave className="text-green-600 text-xs" />
                        <FaUniversity className="text-blue-600 text-xs" />
                    </div>
                );
                colorClass = 'bg-gradient-to-r from-green-100 via-blue-50 to-blue-100 text-gray-800 border border-purple-200';
                labelText = 'Both';
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
        const getAmountStyle = () => {
            if (transaction.tx_type === 'debit') {
                return 'text-red-600 dark:text-red-400';
            } else {
                return 'text-green-600 dark:text-green-400';
            }
        };

        return (
            <tr key={transaction.log_id || transaction.id} className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent dark:hover:from-blue-900/10 dark:hover:to-transparent transition-all duration-200 group animate-fadeIn hover:shadow-sm"
                style={{
                    animationDelay: `${Math.min((transactions.indexOf(transaction) * 50), 500)}ms`
                }}>
                {/* UUID Column */}
                <td className="px-3 py-2">
                    <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-md flex items-center justify-center shadow-sm">
                            <FaShieldAlt className="text-white text-xs" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {transaction.transaction_uuid ? transaction.transaction_uuid.substring(0, 8) : (transaction.uuid || transaction.id)?.toString().substring(0, 8)}...
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                ID #{transaction.log_id || transaction.id}
                            </span>
                        </div>
                    </div>
                </td>

                {/* Date Column */}
                <td className="px-3 py-2">
                    <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-400 to-green-600"></div>
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {formatDate(transaction.transaction_date || transaction.created_at || transaction.createdAt)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(transaction.transaction_date || transaction.created_at || transaction.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                    </div>
                </td>

                {/* Type Column */}
                <td className="px-3 py-2">
                    {transaction.tx_type === 'debit' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm">
                            <FaArrowUp className="mr-1 text-xs" />
                            Debit
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                            <FaArrowDown className="mr-1 text-xs" />
                            Credit
                        </span>
                    )}
                </td>

                {/* Account/Ledger Column */}
                <td className="px-3 py-2">
                    <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-md flex items-center justify-center shadow-sm">
                            <FaUniversity className="text-white text-xs" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {transaction.account?.name || transaction.Account?.name || 'Unknown Account'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {transaction.ledgerHead?.name || transaction.LedgerHead?.name || 'Unknown Ledger'}
                            </span>
                        </div>
                    </div>
                </td>

                {/* Payment Method Column */}
                <td className="px-3 py-2">
                    {transaction.cash_type === 'cash' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-400 to-green-500 text-white shadow-sm">
                            <FaMoneyBillWave className="mr-1 text-xs" />
                            Cash
                        </span>
                    ) : transaction.cash_type === 'bank' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-sm">
                            <FaUniversity className="mr-1 text-xs" />
                            Bank
                        </span>
                    ) : transaction.cash_type === 'both' || transaction.cash_type === 'mixed' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-400 to-purple-500 text-white shadow-sm">
                            <FaCreditCard className="mr-1 text-xs" />
                            Both
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-400 text-white shadow-sm">
                            Unknown
                        </span>
                    )}
                </td>

                {/* Amount Column */}
                <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end">
                        <span className={`text-sm font-bold ${getAmountStyle()}`}>
                            {formatCurrency(transaction.amount)}
                        </span>
                        {(transaction.cash_type === 'both' || transaction.cash_type === 'mixed') && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-y-0.5">
                                <div>Cash: <span className="font-semibold">{formatCurrency(transaction.cash_amount || 0)}</span></div>
                                <div>Bank: <span className="font-semibold">{formatCurrency(transaction.bank_amount || 0)}</span></div>
                            </div>
                        )}
                    </div>
                </td>

                {/* Status Column */}
                <td className="px-3 py-2 text-center">
                    <div className="flex flex-col items-center space-y-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm">
                            <FaLock className="mr-1 text-xs" />
                            Secured
                        </span>
                        {transaction.requires_approval && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-sm">
                                Pending
                            </span>
                        )}
                    </div>
                </td>

                {/* View Action Column */}
                <td className="px-3 py-2 text-center">
                    <button
                        onClick={() => handleViewTransaction(transaction)}
                        className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 hover:from-blue-500 hover:to-blue-600 rounded-lg text-gray-600 dark:text-gray-300 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md group"
                        title="View transaction details"
                    >
                        <FaEye className="w-3 h-3 mx-auto group-hover:scale-110 transition-transform duration-200" />
                    </button>
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

    // Update the tab rendering section to be more beautiful and responsive with smaller font
    const renderTabs = () => {
        return (
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden mb-4">
                <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-secondary-700">
                    <div className="flex items-center text-secondary-700 dark:text-secondary-300 text-sm">
                        <FaListAlt className="mr-2 text-primary-500 dark:text-primary-400" />
                        <span className="font-medium">Transactions List</span>
                    </div>
                    <div className="ml-auto flex items-center space-x-2 text-xs">
                        <div className="bg-gray-100 dark:bg-secondary-700 rounded-lg px-3 py-1 text-secondary-700 dark:text-secondary-300 font-medium">
                            {totalTransactions} Transactions
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-secondary-700 dark:hover:bg-secondary-600 rounded-lg text-secondary-700 dark:text-secondary-300 transition-colors"
                        >
                            <FaFilter className="mr-1.5" />
                            <span>Filters</span>
                        </button>
                        <button
                            onClick={() => fetchTransactions()}
                            className="flex items-center px-3 py-1 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400 transition-colors"
                        >
                            <FaSync className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col">
                    <div className="flex flex-wrap border-b border-gray-100 dark:border-secondary-700">
                        {tabs.map((tab) => {
                            // Determine if this is the active tab
                            const isActive = activeTab === tab.id;

                            // Get tab count number based on status
                            let count = 0;
                            if (tab.id === 'pending') count = pendingCount;
                            else if (tab.id === 'cancelled') count = cancelledCount;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex items-center py-2.5 px-4 text-xs font-medium relative transition-colors
                                        ${isActive
                                            ? 'text-primary-600 dark:text-primary-400 bg-white dark:bg-secondary-800'
                                            : 'text-secondary-600 dark:text-secondary-400 hover:bg-gray-50 dark:hover:bg-secondary-700'}
                                    `}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>

                                    {/* Show count for pending and cancelled tabs */}
                                    {count > 0 && (tab.id === 'pending' || tab.id === 'cancelled') && (
                                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs
                                            ${tab.id === 'pending'
                                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}
                                        `}>
                                            {count}
                                        </span>
                                    )}

                                    {/* Active indicator */}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 dark:bg-primary-400"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Cheque type filter for pending/cancelled tabs */}
                    {(activeTab === 'pending' || activeTab === 'cancelled') && (
                        <div className="flex items-center px-4 py-2.5 border-b border-gray-100 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-800/50">
                            <div className="text-xs text-secondary-500 dark:text-secondary-400 mr-2">Filter by:</div>
                            <div className="flex space-x-2">
                                {chequeTypeOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleChequeTypeChange(option.value)}
                                        className={`px-2.5 py-1 rounded-md text-xs transition-colors
                                            ${chequeTypeFilter === option.value
                                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                                                : 'bg-white dark:bg-secondary-700 hover:bg-gray-100 dark:hover:bg-secondary-600 text-secondary-700 dark:text-secondary-300'}
                                        `}
                                    >
                                        {option.label}
                                        {/* Add count badge for specific options */}
                                        {option.value !== 'all' && (
                                            <span className="ml-1 text-xs">
                                                ({activeTab === 'pending'
                                                    ? (option.value === 'debit' ? pendingDebitCount : pendingCreditCount)
                                                    : (option.value === 'debit' ? cancelledDebitCount : cancelledCreditCount)
                                                })
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tab description */}
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-gray-100 dark:border-secondary-700">
                        <div className="flex items-center text-xs text-blue-700 dark:text-blue-400">
                            <FaInfoCircle className="mr-2 flex-shrink-0" />
                            <p>{getTabDescription()}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Render tabs at the top */}
            {renderTabs()}

            {/* Filters section */}
            {showFilters && (
                <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-secondary-700">
                        <h3 className="text-xs font-medium text-secondary-800 dark:text-white flex items-center">
                            <FaFilter className="mr-2 text-primary-500 dark:text-primary-400" />
                            Filter Transactions
                        </h3>
                    </div>

                    <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                            <div>
                                <label className="block text-xs text-secondary-500 dark:text-secondary-400 mb-1">Account</label>
                                <select
                                    name="account_id"
                                    value={filters.account_id}
                                    onChange={handleFilterChange}
                                    className="w-full rounded-md border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-secondary-800 dark:text-white text-xs py-1.5 px-2"
                                >
                                    <option value="">All Accounts</option>
                                    {accounts.map(account => (
                                        <option key={account.id} value={account.id}>{account.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-secondary-500 dark:text-secondary-400 mb-1">Ledger Head</label>
                                <select
                                    name="ledger_head_id"
                                    value={filters.ledger_head_id}
                                    onChange={handleFilterChange}
                                    className="w-full rounded-md border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-secondary-800 dark:text-white text-xs py-1.5 px-2"
                                >
                                    <option value="">All Ledger Heads</option>
                                    {ledgerHeads.map(head => (
                                        <option key={head.id} value={head.id}>{head.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-secondary-500 dark:text-secondary-400 mb-1">From Date</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                                        <FaCalendarAlt className="w-3 h-3 text-secondary-400 dark:text-secondary-500" />
                                    </div>
                                    <input
                                        type="date"
                                        name="start_date"
                                        value={filters.start_date}
                                        onChange={handleFilterChange}
                                        className="w-full pl-8 pr-2 py-1.5 rounded-md border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-secondary-800 dark:text-white text-xs"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-secondary-500 dark:text-secondary-400 mb-1">To Date</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                                        <FaCalendarAlt className="w-3 h-3 text-secondary-400 dark:text-secondary-500" />
                                    </div>
                                    <input
                                        type="date"
                                        name="end_date"
                                        value={filters.end_date}
                                        onChange={handleFilterChange}
                                        className="w-full pl-8 pr-2 py-1.5 rounded-md border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-secondary-800 dark:text-white text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                onClick={clearFilters}
                                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-secondary-700 dark:hover:bg-secondary-600 text-secondary-700 dark:text-secondary-300 rounded-md transition-colors"
                            >
                                <FaTimes className="mr-1 inline-block" />
                                Clear Filters
                            </button>
                            <button
                                onClick={fetchTransactions}
                                className="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                            >
                                <FaFilter className="mr-1 inline-block" />
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl p-4 mb-4">
                    <div className="flex">
                        <FaExclamationTriangle className="h-5 w-5 text-red-500 mr-2" aria-hidden="true" />
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Transactions table */}
            <div className="bg-white dark:bg-secondary-800 rounded-2xl shadow-lg border border-gray-100 dark:border-secondary-700 overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-secondary-700">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <FaShieldAlt className="h-3 w-3 text-blue-500" />
                                        <span>ID</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <FaCalendarAlt className="h-3 w-3 text-green-500" />
                                        <span>Date</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <FaExchangeAlt className="h-3 w-3 text-purple-500" />
                                        <span>Type</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <FaUniversity className="h-3 w-3 text-indigo-500" />
                                        <span>Account</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <FaCreditCard className="h-3 w-3 text-orange-500" />
                                        <span>Payment</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <div className="flex items-center justify-end space-x-1">
                                        <FaMoneyBillWave className="h-3 w-3 text-green-600" />
                                        <span>Amount</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <div className="flex items-center justify-center space-x-1">
                                        <FaLock className="h-3 w-3 text-blue-600" />
                                        <span>Status</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <FaEye className="h-3 w-3 text-gray-500" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-secondary-800 divide-y divide-gray-50 dark:divide-secondary-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="relative">
                                                <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 dark:border-gray-700"></div>
                                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500 absolute top-0 left-0"></div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Loading Transactions</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">Fetching your transaction history...</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center shadow-inner">
                                                <FaExchangeAlt className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                            </div>
                                            <div className="text-center max-w-sm">
                                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No Transactions Found</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">There are no transactions matching your current filters. Try adjusting your search criteria or create your first transaction.</p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                                <button
                                                    onClick={() => clearFilters()}
                                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                                                >
                                                    <FaTimes className="w-3 h-3 mr-2" />
                                                    Clear Filters
                                                </button>
                                                <button
                                                    onClick={() => fetchTransactions()}
                                                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                                                >
                                                    <FaSync className="w-3 h-3 mr-2" />
                                                    Refresh
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(transaction => renderTransactionRow(transaction))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && transactions.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-secondary-700 px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                        <div className="text-xs text-secondary-500 dark:text-secondary-400">
                            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalTransactions)} of {totalTransactions} transactions
                        </div>
                        {renderPagination()}
                    </div>
                )}
            </div>
        </>
    );
} 