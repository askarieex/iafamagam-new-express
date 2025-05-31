import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaCheck,
    FaTimes,
    FaSync,
    FaFilter,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaFileInvoiceDollar,
    FaInfoCircle,
    FaWrench
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

export default function ChequeManagement() {
    // State variables
    const [cheques, setCheques] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chequeCounts, setChequeCounts] = useState({
        pending: 0,
        cleared: 0,
        cancelled: 0
    });

    // Filters
    const [filters, setFilters] = useState({
        status: 'pending', // Default to showing pending cheques
        account_id: '',
        ledger_head_id: '',
        from_date: '',
        to_date: ''
    });

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch data on component mount
    useEffect(() => {
        fetchCheques();
        fetchAccounts();
        fetchLedgerHeads();
    }, []);

    // Fetch cheques with filters
    const fetchCheques = async () => {
        try {
            setLoading(true);
            setError(null);

            // Construct query params from filters
            let queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    queryParams.append(key, value);
                }
            });

            console.log(`Fetching cheques with query: /api/cheques?${queryParams.toString()}`);
            const response = await api.get(`/api/cheques?${queryParams.toString()}`);
            console.log('API response:', response.data);

            if (response.data.success) {
                // Handle various response formats consistently
                if (Array.isArray(response.data.data)) {
                    setCheques(response.data.data);
                    console.log(`Received ${response.data.data.length} cheques`);
                } else if (response.data.data && Array.isArray(response.data.data.cheques)) {
                    setCheques(response.data.data.cheques);
                    console.log(`Received ${response.data.data.cheques.length} cheques`);
                } else if (response.data.data) {
                    // If data is not an array, try to convert it
                    const chequeData = response.data.data;
                    if (typeof chequeData === 'object' && !Array.isArray(chequeData)) {
                        // If it's a single object, wrap it in an array
                        setCheques([chequeData]);
                    } else {
                        console.error('Unexpected data format:', response.data.data);
                        setError('Failed to fetch cheques: Data format is not as expected');
                        setCheques([]);
                    }
                } else {
                    // Set empty array if no data
                    setCheques([]);
                }

                // Set the cheque counts
                if (response.data.counts) {
                    setChequeCounts(response.data.counts);
                }
            } else {
                console.error('API response not successful:', response.data);
                setError(`Failed to fetch cheques: ${response.data.message || 'Unknown error'}`);
                setCheques([]);
            }
        } catch (err) {
            console.error('Error fetching cheques:', err);
            setError(`Failed to fetch cheques: ${err.response?.data?.message || err.message}`);
            setCheques([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch accounts for filter dropdown
    const fetchAccounts = async () => {
        try {
            const response = await api.get('/api/accounts');
            if (response.data.success && response.data.data) {
                setAccounts(Array.isArray(response.data.data) ? response.data.data : []);
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);
            toast.error('Failed to load account data');
        }
    };

    // Fetch ledger heads for filter dropdown
    const fetchLedgerHeads = async () => {
        try {
            const response = await api.get('/api/ledger-heads');
            if (response.data.success && response.data.data) {
                setLedgerHeads(Array.isArray(response.data.data) ? response.data.data : []);
            }
        } catch (err) {
            console.error('Error fetching ledger heads:', err);
            toast.error('Failed to load ledger head data');
        }
    };

    // Handle filter changes
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Apply filters
    const applyFilters = () => {
        fetchCheques();
    };

    // Reset filters
    const resetFilters = () => {
        setFilters({
            status: 'pending',
            account_id: '',
            ledger_head_id: '',
            from_date: '',
            to_date: ''
        });
        // Fetch data with reset filters
        setTimeout(() => fetchCheques(), 0);
    };

    // Fix missing cheque records
    const handleFixMissingCheques = async () => {
        if (!window.confirm('This will create missing cheque records for transactions with cash_type="cheque". Continue?')) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await api.post('/api/cheques/fix-missing');

            if (response.data.success) {
                toast.success(`${response.data.message || 'Missing cheque records fixed successfully'}`);
                fetchCheques(); // Refresh the list
            } else {
                toast.error(`Failed to fix missing cheque records: ${response.data.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error fixing missing cheque records:', err);
            toast.error(`Failed to fix missing cheque records: ${err.response?.data?.message || err.message}`);
            setError(`Failed to fix missing cheque records: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Mark a cheque as cleared
    const handleClearCheque = async (chequeId) => {
        if (!window.confirm('Are you sure you want to clear this cheque? This will deduct the amount from balances.')) {
            return;
        }

        try {
            setLoading(true);
            const response = await api.put(`/api/cheques/${chequeId}/clear`, {
                clearing_date: new Date().toISOString().split('T')[0] // Today's date
            });

            if (response.data.success) {
                toast.success('Cheque cleared successfully');
                fetchCheques(); // Refresh the list
            } else {
                toast.error(`Failed to clear cheque: ${response.data.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error clearing cheque:', err);
            toast.error(`Error clearing cheque: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Cancel a cheque
    const handleCancelCheque = async (chequeId) => {
        const reason = window.prompt('Please enter a reason for cancellation (optional):');
        if (reason === null) return; // User clicked Cancel on the prompt

        try {
            setLoading(true);
            const response = await api.put(`/api/cheques/${chequeId}/cancel`, { reason });

            if (response.data.success) {
                toast.success('Cheque cancelled successfully');
                fetchCheques(); // Refresh the list
            } else {
                toast.error(`Failed to cancel cheque: ${response.data.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error cancelling cheque:', err);
            toast.error(`Error cancelling cheque: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Format currency
    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            style: 'currency',
            currency: 'INR'
        });
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (err) {
            console.error('Error formatting date:', err);
            return dateString;
        }
    };

    // Render status badge
    const renderStatusBadge = (status) => {
        let color, icon;

        switch (status) {
            case 'pending':
                color = 'bg-yellow-100 text-yellow-800';
                icon = <FaMoneyBillWave className="mr-1" />;
                break;
            case 'cleared':
                color = 'bg-green-100 text-green-800';
                icon = <FaCheck className="mr-1" />;
                break;
            case 'cancelled':
                color = 'bg-red-100 text-red-800';
                icon = <FaTimes className="mr-1" />;
                break;
            default:
                color = 'bg-gray-100 text-gray-800';
                icon = null;
        }

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                {icon}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    return (
        <div className="cheque-management-page p-6">
            <div className="content-wrapper bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="page-header flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <FaMoneyBillWave className="mr-3 text-indigo-600" />
                        Cheque Management
                    </h1>

                    <button
                        onClick={handleFixMissingCheques}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <FaWrench className="mr-2 -ml-1 h-4 w-4" />
                        Fix Missing Cheques
                    </button>
                </div>

                {error && (
                    <div className="error-message bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <FaTimes className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="filters-section bg-gray-50 p-4 rounded-lg mb-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="filter-group">
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <select
                                id="status"
                                name="status"
                                value={filters.status}
                                onChange={handleFilterChange}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                                <option value="">All</option>
                                <option value="pending">Pending ({chequeCounts.pending})</option>
                                <option value="cleared">Cleared ({chequeCounts.cleared})</option>
                                <option value="cancelled">Cancelled ({chequeCounts.cancelled})</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="account_id" className="block text-sm font-medium text-gray-700 mb-1">
                                Account
                            </label>
                            <select
                                id="account_id"
                                name="account_id"
                                value={filters.account_id}
                                onChange={handleFilterChange}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                                <option value="">All Accounts</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="ledger_head_id" className="block text-sm font-medium text-gray-700 mb-1">
                                Ledger Head
                            </label>
                            <select
                                id="ledger_head_id"
                                name="ledger_head_id"
                                value={filters.ledger_head_id}
                                onChange={handleFilterChange}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                                <option value="">All Ledger Heads</option>
                                {ledgerHeads.map(head => (
                                    <option key={head.id} value={head.id}>
                                        {head.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="from_date" className="block text-sm font-medium text-gray-700 mb-1">
                                From Date
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FaCalendarAlt className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    id="from_date"
                                    name="from_date"
                                    value={filters.from_date}
                                    onChange={handleFilterChange}
                                    className="block w-full pl-10 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                />
                            </div>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="to_date" className="block text-sm font-medium text-gray-700 mb-1">
                                To Date
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FaCalendarAlt className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    id="to_date"
                                    name="to_date"
                                    value={filters.to_date}
                                    onChange={handleFilterChange}
                                    className="block w-full pl-10 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={resetFilters}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-10"
                            >
                                <FaTimes className="mr-2 -ml-1 h-4 w-4" />
                                Reset
                            </button>
                            <button
                                onClick={applyFilters}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-10"
                            >
                                <FaFilter className="mr-2 -ml-1 h-4 w-4" />
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="loading text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
                        <p className="mt-3 text-gray-600">Loading cheques...</p>
                    </div>
                ) : (
                    <div className="cheque-list">
                        {cheques.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                                <FaFileInvoiceDollar className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No cheques found</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    No cheques match your current filter criteria.
                                </p>
                                {filters.status === 'pending' && (
                                    <div className="mt-4 bg-yellow-50 p-4 rounded-md max-w-md mx-auto">
                                        <div className="flex">
                                            <div className="flex-shrink-0">
                                                <FaInfoCircle className="h-5 w-5 text-yellow-400" />
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm text-yellow-700">
                                                    If you expected to see pending cheques, please check:
                                                    <ul className="list-disc pl-5 mt-1 space-y-1">
                                                        <li>You have created transactions with payment method "Cheque"</li>
                                                        <li>The transactions have status "pending"</li>
                                                        <li>Try clicking the <strong>"Fix Missing Cheques"</strong> button above to create cheque records for any pending cheque transactions</li>
                                                    </ul>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Cheque #
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Bank
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Account / Ledger Head
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
                                        {cheques.map((cheque, index) => (
                                            <tr key={cheque.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {cheque.cheque_number || 'No Number'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {cheque.bank_name || 'Not Specified'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <div className="font-medium">{cheque.account?.name || 'Unknown Account'}</div>
                                                    <div className="text-xs text-gray-400">{cheque.ledgerHead?.name || cheque.ledger_head?.name || 'Unknown Ledger'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatCurrency(cheque.amount || cheque.transaction?.amount || 0)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatDate(cheque.issue_date)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatDate(cheque.due_date)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {renderStatusBadge(cheque.status || 'unknown')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {cheque.status === 'pending' && (
                                                        <div className="flex justify-end space-x-2">
                                                            <button
                                                                onClick={() => handleClearCheque(cheque.id)}
                                                                className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-1.5 rounded-md transition-colors"
                                                                title="Mark as Cleared"
                                                                disabled={!cheque.id}
                                                            >
                                                                <FaCheck className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancelCheque(cheque.id)}
                                                                className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors"
                                                                title="Cancel Cheque"
                                                                disabled={!cheque.id}
                                                            >
                                                                <FaTimes className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {cheque.status !== 'pending' && (
                                                        <span className="text-gray-400">
                                                            {cheque.status === 'cleared' && cheque.clearing_date && `Cleared on ${formatDate(cheque.clearing_date)}`}
                                                            {cheque.status === 'cancelled' && (cheque.cancel_reason ? `Cancelled: ${cheque.cancel_reason}` : 'Cancelled')}
                                                            {!['cleared', 'cancelled'].includes(cheque.status) && 'No actions available'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
} 