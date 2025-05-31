import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaSearch,
    FaFilter,
    FaSync,
    FaTimes,
    FaEye,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaCalendarAlt,
    FaMoneyCheck
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

export default function ChequesList({ onViewCheque }) {
    const [cheques, setCheques] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [confirmActionId, setConfirmActionId] = useState(null);
    const [confirmActionType, setConfirmActionType] = useState(null); // 'clear' or 'cancel'

    // Filter state
    const [filters, setFilters] = useState({
        status: 'pending', // Default to showing pending cheques
        account_id: '',
        ledger_head_id: '',
        from_date: '',
        to_date: ''
    });

    // Options for filters
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch cheques with filters
    const fetchCheques = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query parameters
            let params = {};

            // Add filters to params if they exist
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params[key] = filters[key];
                }
            });

            const response = await api.get('/api/cheques', { params });

            if (response.data && response.data.success) {
                setCheques(response.data.data || []);
            } else {
                setCheques([]);
                console.warn('Unexpected API response format:', response.data);
            }
        } catch (err) {
            console.error('Error fetching cheques:', err);

            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                setError(`Failed to fetch cheques. Server responded with: ${err.response.status} ${err.response.statusText}`);
            } else {
                setError(`Failed to fetch cheques: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch filter options (accounts, ledger heads)
    const fetchFilterOptions = async () => {
        try {
            const [accountsRes, ledgerHeadsRes] = await Promise.all([
                api.get('/api/accounts'),
                api.get('/api/ledger-heads')
            ]);

            setAccounts(accountsRes.data.data || []);
            setLedgerHeads(ledgerHeadsRes.data.data || []);
        } catch (err) {
            console.error('Error fetching filter options:', err);
        }
    };

    // Load cheques and filter options on component mount
    useEffect(() => {
        fetchCheques();
        fetchFilterOptions();
    }, []);

    // Reload cheques when filters change
    useEffect(() => {
        fetchCheques();
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
            status: 'pending', // Keep the default status filter
            account_id: '',
            ledger_head_id: '',
            from_date: '',
            to_date: ''
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
        if (!dateString) return "—";
        const date = new Date(dateString);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    // Render cheque status badge
    const renderChequeStatus = (status) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                        <FaClock className="mr-1.5" />
                        Pending
                    </span>
                );
            case 'cleared':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        <FaCheckCircle className="mr-1.5" />
                        Cleared
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        <FaTimesCircle className="mr-1.5" />
                        Cancelled
                    </span>
                );
            default:
                return status;
        }
    };

    // Handle clearing a cheque
    const handleClearCheque = async (id) => {
        try {
            setLoading(true);

            const response = await api.put(`/api/cheques/${id}/clear`, {
                clearing_date: new Date().toISOString().split('T')[0] // Current date in YYYY-MM-DD format
            });

            if (response.data && response.data.success) {
                toast.success('Cheque cleared successfully', {
                    position: "top-right",
                    autoClose: 3000
                });
                fetchCheques(); // Refresh the list
            } else {
                console.warn('Unexpected API response format:', response.data);
                toast.error('Failed to clear cheque', {
                    position: "top-right",
                    autoClose: 3000
                });
            }
        } catch (err) {
            console.error('Error clearing cheque:', err);
            toast.error(`Error clearing cheque: ${err.message}`, {
                position: "top-right",
                autoClose: 5000
            });
        } finally {
            setLoading(false);
            setConfirmActionId(null);
            setConfirmActionType(null);
        }
    };

    // Handle cancelling a cheque
    const handleCancelCheque = async (id, reason = '') => {
        try {
            setLoading(true);

            const response = await api.put(`/api/cheques/${id}/cancel`, { reason });

            if (response.data && response.data.success) {
                toast.success('Cheque cancelled successfully', {
                    position: "top-right",
                    autoClose: 3000
                });
                fetchCheques(); // Refresh the list
            } else {
                console.warn('Unexpected API response format:', response.data);
                toast.error('Failed to cancel cheque', {
                    position: "top-right",
                    autoClose: 3000
                });
            }
        } catch (err) {
            console.error('Error cancelling cheque:', err);
            toast.error(`Error cancelling cheque: ${err.message}`, {
                position: "top-right",
                autoClose: 5000
            });
        } finally {
            setLoading(false);
            setConfirmActionId(null);
            setConfirmActionType(null);
        }
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
                        onClick={fetchCheques}
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
                    <FaMoneyCheck className="mr-2 text-indigo-500" />
                    Cheque Management
                </h1>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium shadow-sm">
                        {cheques.length} Cheques
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
                        onClick={fetchCheques}
                        disabled={loading}
                    >
                        <FaSync className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters form */}
            {showFilters && (
                <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <FaFilter className="mr-2 text-indigo-500" />
                        Cheque Filters
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                name="status"
                                value={filters.status}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="cleared">Cleared</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

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
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                            <input
                                type="date"
                                name="from_date"
                                value={filters.from_date}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                            <input
                                type="date"
                                name="to_date"
                                value={filters.to_date}
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
                            onClick={fetchCheques}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <FaSearch className="mr-1.5 inline" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Cheques table */}
            <div className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cheque #
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Bank
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Account / Ledger
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Amount
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Issue Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Due Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {cheques.length > 0 ? (
                                cheques.map(cheque => (
                                    <tr key={cheque.id} className="hover:bg-gray-50 transition duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                                            {cheque.cheque_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {cheque.bank_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-700">{cheque.account?.name || 'Unknown Account'}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {cheque.ledgerHead?.name || 'Unknown Ledger Head'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <span className={`${cheque.status !== 'cleared' ? 'text-gray-400' : 'text-red-600'}`}>
                                                {formatCurrency(cheque.transaction?.amount || 0)}
                                            </span>
                                            {cheque.status === 'pending' && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Not deducted yet
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {formatDate(cheque.issue_date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {formatDate(cheque.due_date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {renderChequeStatus(cheque.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => onViewCheque && onViewCheque(cheque)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="View Details"
                                                >
                                                    <FaEye />
                                                </button>

                                                {cheque.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setConfirmActionId(cheque.id);
                                                                setConfirmActionType('clear');
                                                            }}
                                                            className="text-green-600 hover:text-green-900"
                                                            title="Clear Cheque"
                                                        >
                                                            <FaCheckCircle />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setConfirmActionId(cheque.id);
                                                                setConfirmActionType('cancel');
                                                            }}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Cancel Cheque"
                                                        >
                                                            <FaTimesCircle />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                                        {loading ? (
                                            <div className="flex justify-center items-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
                                                Loading cheques...
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <FaMoneyCheck className="text-4xl text-gray-300 mb-3" />
                                                <p className="text-lg">No cheques found</p>
                                                <p className="text-sm mt-1">Try adjusting your filters or adding new cheques</p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirm Action Modal */}
            {confirmActionId && (
                <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => {
                        setConfirmActionId(null);
                        setConfirmActionType(null);
                    }}></div>
                    <div className="relative bg-white rounded-lg max-w-md w-full mx-auto shadow-xl z-10 p-6">
                        <div className="text-center">
                            {confirmActionType === 'clear' ? (
                                <>
                                    <FaCheckCircle className="mx-auto text-green-500 text-5xl mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Cheque Clearing</h3>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Are you sure you want to clear this cheque? This will deduct the amount from the source ledger head and mark the transaction as completed.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <FaTimesCircle className="mx-auto text-red-500 text-5xl mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Cheque Cancellation</h3>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Are you sure you want to cancel this cheque? The transaction will be marked as cancelled and no amount will be deducted.
                                    </p>
                                </>
                            )}
                            <div className="flex justify-center space-x-3">
                                <button
                                    type="button"
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md focus:outline-none"
                                    onClick={() => {
                                        setConfirmActionId(null);
                                        setConfirmActionType(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className={`px-4 py-2 text-white rounded-md focus:outline-none ${confirmActionType === 'clear'
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                    onClick={() => {
                                        if (confirmActionType === 'clear') {
                                            handleClearCheque(confirmActionId);
                                        } else {
                                            handleCancelCheque(confirmActionId);
                                        }
                                    }}
                                >
                                    {confirmActionType === 'clear' ? 'Yes, Clear Cheque' : 'Yes, Cancel Cheque'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 