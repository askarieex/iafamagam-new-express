import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    FaCheckCircle,
    FaExclamationTriangle,
    FaQuestionCircle,
    FaCalendarCheck,
    FaLock,
    FaUnlock
} from 'react-icons/fa';
import API_CONFIG from '../../config';

export default function AccountClosureStatus() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [closingAccount, setClosingAccount] = useState(null);
    const [reopeningAccount, setReopeningAccount] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null); // 'close' or 'reopen'
    const [formData, setFormData] = useState({
        account_id: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        new_closing_date: ''
    });
    const [processingAction, setProcessingAction] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch the accounts with their closure status
    const fetchAccounts = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/status`);

            if (response.data.success) {
                setAccounts(response.data.data);
            } else {
                setError(response.data.message || 'Failed to fetch accounts');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    // Handle opening the close period modal
    const handleClosePeriodClick = (account) => {
        setClosingAccount(account);
        setFormData({
            ...formData,
            account_id: account.id,
            month: new Date().getMonth(), // Previous month (0-indexed)
            year: new Date().getFullYear()
        });
        setModalType('close');
        setIsModalOpen(true);
    };

    // Handle opening the reopen period modal
    const handleReopenPeriodClick = (account) => {
        setReopeningAccount(account);

        // Calculate the month before the last closed date
        const lastClosed = new Date(account.last_closed_date);
        const previousMonth = new Date(lastClosed);
        previousMonth.setDate(0); // Go to last day of previous month

        setFormData({
            ...formData,
            account_id: account.id,
            new_closing_date: previousMonth.toISOString().split('T')[0]
        });

        setModalType('reopen');
        setIsModalOpen(true);
    };

    // Handle input change
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    // Submit the period closure
    const handleClosePeriodSubmit = async (e) => {
        e.preventDefault();
        setProcessingAction(true);

        try {
            const { account_id, month, year } = formData;

            const response = await axios.post(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/close`,
                { account_id, month, year }
            );

            if (response.data.success) {
                toast.success('Period closed successfully');
                fetchAccounts();
                setIsModalOpen(false);
                setClosingAccount(null);
            } else {
                toast.error(response.data.message || 'Failed to close period');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setProcessingAction(false);
        }
    };

    // Submit the period reopening
    const handleReopenPeriodSubmit = async (e) => {
        e.preventDefault();
        setProcessingAction(true);

        try {
            const { account_id, new_closing_date } = formData;

            const response = await axios.post(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/reopen`,
                { account_id, new_closing_date }
            );

            if (response.data.success) {
                toast.success('Period reopened successfully');
                fetchAccounts();
                setIsModalOpen(false);
                setReopeningAccount(null);
            } else {
                toast.error(response.data.message || 'Failed to reopen period');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setProcessingAction(false);
        }
    };

    // Get status badge for an account
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'current':
                return (
                    <span className="flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        <FaCheckCircle className="mr-1" />
                        Current
                    </span>
                );
            case 'recent':
                return (
                    <span className="flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        <FaCalendarCheck className="mr-1" />
                        Recent
                    </span>
                );
            case 'outdated':
                return (
                    <span className="flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        <FaExclamationTriangle className="mr-1" />
                        Outdated
                    </span>
                );
            case 'never_closed':
            default:
                return (
                    <span className="flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        <FaQuestionCircle className="mr-1" />
                        Never Closed
                    </span>
                );
        }
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Get month name from month number
    const getMonthName = (month) => {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return monthNames[month - 1];
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-6">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                <strong className="font-bold">Error!</strong>
                <span className="block sm:inline"> {error}</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Account Closure Status</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">View and manage accounting period closures.</p>
            </div>

            <div className="border-t border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Closed Date</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {accounts.map((account) => (
                            <tr key={account.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{account.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{formatDate(account.last_closed_date)}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {renderStatusBadge(account.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleClosePeriodClick(account)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                        <FaLock className="inline mr-1" />
                                        Close Period
                                    </button>
                                    {account.last_closed_date && (
                                        <button
                                            onClick={() => handleReopenPeriodClick(account)}
                                            className="text-amber-600 hover:text-amber-900"
                                        >
                                            <FaUnlock className="inline mr-1" />
                                            Reopen Period
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal for closing/reopening periods */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                        {modalType === 'close' && (
                            <>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Close Accounting Period</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    This will close the accounting period for {closingAccount?.name}.
                                    All transactions dated within or before this period will be locked.
                                </p>

                                <form onSubmit={handleClosePeriodSubmit}>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Month</label>
                                        <select
                                            name="month"
                                            value={formData.month}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            required
                                        >
                                            {Array.from({ length: 12 }, (_, i) => (
                                                <option key={i + 1} value={i + 1}>
                                                    {getMonthName(i + 1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700">Year</label>
                                        <input
                                            type="number"
                                            name="year"
                                            value={formData.year}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            min="2000"
                                            max="2100"
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                            disabled={processingAction}
                                        >
                                            {processingAction ? (
                                                <span className="flex items-center">
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Processing...
                                                </span>
                                            ) : 'Close Period'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}

                        {modalType === 'reopen' && (
                            <>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Reopen Accounting Period</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    This will change the last closed date to an earlier date for {reopeningAccount?.name},
                                    allowing transactions in the reopened period. Use with caution.
                                </p>

                                <form onSubmit={handleReopenPeriodSubmit}>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700">New Closing Date</label>
                                        <input
                                            type="date"
                                            name="new_closing_date"
                                            value={formData.new_closing_date}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            max={reopeningAccount?.last_closed_date}
                                            required
                                        />
                                        <p className="mt-1 text-xs text-gray-500">
                                            Select a date earlier than {formatDate(reopeningAccount?.last_closed_date)}
                                        </p>
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                                            disabled={processingAction}
                                        >
                                            {processingAction ? (
                                                <span className="flex items-center">
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Processing...
                                                </span>
                                            ) : 'Reopen Period'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
} 