import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaArrowLeft,
    FaFileInvoice,
    FaPrint,
    FaTrash,
    FaExclamationTriangle,
    FaArrowUp,
    FaArrowDown,
    FaMoneyBillWave,
    FaCreditCard,
    FaMobileAlt,
    FaUniversity,
    FaReceipt,
    FaInfoCircle,
    FaFile,
    FaEdit,
    FaClock,
    FaCheckCircle,
    FaTimesCircle,
    FaMoneyCheck,
    FaTable
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

export default function TransactionDetails({ transactionId, onBack, onEditTransaction }) {
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: 8000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch transaction details
    const fetchTransaction = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log(`Fetching transaction details for ID: ${transactionId}`);

            // Make sure we're using the correct API endpoint format
            const response = await api.get(`${API_CONFIG.API_PREFIX}/transactions/${transactionId}`);
            console.log('Transaction API response:', response.data);

            if (response.data && response.data.success) {
                // Check if transaction data is in response.data.transaction or response.data.data
                const transactionData = response.data.transaction || response.data.data;

                if (transactionData) {
                    console.log('Transaction data found:', transactionData);
                    setTransaction(transactionData);
                } else {
                    console.error('Transaction data not found in response:', response.data);
                    setError('Transaction data not found in server response');
                }
            } else {
                setError('Failed to load transaction details');
            }
        } catch (err) {
            console.error('Error fetching transaction:', err);

            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                if (err.response.status === 404) {
                    setError(`Transaction not found. The transaction may have been deleted or does not exist.`);
                } else {
                    setError(`Failed to load transaction. Server responded with: ${err.response.status} ${err.response.statusText}`);
                }
            } else {
                setError(`Failed to load transaction: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Load transaction data on component mount
    useEffect(() => {
        if (transactionId) {
            fetchTransaction();
        }
    }, [transactionId]);

    // Handle delete transaction
    const handleDelete = async () => {
        try {
            setLoading(true);

            const response = await api.delete(`${API_CONFIG.API_PREFIX}/transactions/${transactionId}`);

            if (response.data && response.data.success) {
                toast.success('Transaction voided successfully', {
                    position: "top-right",
                    autoClose: 3000
                });
                onBack(); // Go back to transactions list
            } else {
                setError('Failed to void transaction');
                toast.error('Failed to void transaction', {
                    position: "top-right",
                    autoClose: 5000
                });
            }
        } catch (err) {
            console.error('Error voiding transaction:', err);
            setError(`Failed to void transaction: ${err.message}`);
            toast.error(`Failed to void transaction: ${err.message}`, {
                position: "top-right",
                autoClose: 5000
            });
        } finally {
            setLoading(false);
            setShowDeleteConfirm(false);
        }
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

    // Render transaction type badge
    const renderTransactionType = (txType) => {
        if (txType === 'credit') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FaArrowDown className="mr-1" />
                    Credit
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <FaArrowUp className="mr-1" />
                    Debit
                </span>
            );
        }
    };

    // Render status badge
    const renderStatusBadge = (status, isCheque = false) => {
        if (isCheque) {
            const chequeStatus = transaction.cheque?.status || 'pending';

            const statusConfig = {
                pending: {
                    bgColor: 'bg-yellow-100',
                    textColor: 'text-yellow-800',
                    icon: <FaClock className="mr-1" />,
                    text: 'Pending Cheque'
                },
                cleared: {
                    bgColor: 'bg-green-100',
                    textColor: 'text-green-800',
                    icon: <FaCheckCircle className="mr-1" />,
                    text: 'Cleared Cheque'
                },
                cancelled: {
                    bgColor: 'bg-red-100',
                    textColor: 'text-red-800',
                    icon: <FaTimesCircle className="mr-1" />,
                    text: 'Cancelled Cheque'
                }
            };

            const { bgColor, textColor, icon, text } = statusConfig[chequeStatus];

            return (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
                    {icon}
                    {text}
                </span>
            );
        }

        // Regular transaction status
        if (status === 'pending') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <FaClock className="mr-1" />
                    Pending
                </span>
            );
        } else if (status === 'cancelled') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <FaTimesCircle className="mr-1" />
                    Cancelled
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FaCheckCircle className="mr-1" />
                    Completed
                </span>
            );
        }
    };

    // Render cash type icon
    const renderCashType = (cashType) => {
        switch (cashType) {
            case 'cash':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        <FaMoneyBillWave className="mr-1" />
                        Cash
                    </span>
                );
            case 'bank':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        <FaUniversity className="mr-1" />
                        Bank Transfer
                    </span>
                );
            case 'upi':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        <FaMobileAlt className="mr-1" />
                        UPI
                    </span>
                );
            case 'card':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        <FaCreditCard className="mr-1" />
                        Card
                    </span>
                );
            case 'multiple':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <FaMoneyBillWave className="mr-1" />
                        Cash & Bank
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {cashType}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
                    <div className="flex items-center">
                        <FaExclamationTriangle className="flex-shrink-0 mr-2" />
                        <h3 className="font-bold">Error</h3>
                    </div>
                    <p className="mt-1 text-sm">{error}</p>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-blue-600 font-medium">Loading transaction details...</span>
                </div>
            ) : transaction ? (
                <div>
                    {/* Actions bar */}
                    <div className="flex justify-between items-center mb-6">
                        <button
                            onClick={onBack}
                            className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
                        >
                            <FaArrowLeft className="mr-1.5" />
                            Back to Transactions
                        </button>
                        <div className="flex space-x-3">
                            {transaction.tx_type === 'credit' && (
                                <button
                                    onClick={() => onEditTransaction(transaction)}
                                    className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium flex items-center transition-colors"
                                >
                                    <FaEdit className="mr-1.5" />
                                    Edit
                                </button>
                            )}
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center transition-colors"
                            >
                                <FaTrash className="mr-1.5" />
                                Void
                            </button>
                        </div>
                    </div>

                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 shadow-sm mb-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                                    {transaction.tx_type === 'credit' ? (
                                        <FaArrowDown className="text-green-600 mr-2 text-lg" />
                                    ) : (
                                        <FaArrowUp className="text-red-600 mr-2 text-lg" />
                                    )}
                                    {transaction.tx_type === 'credit' ? 'Credit' : 'Debit'} Transaction
                                </h2>
                                <div className="flex space-x-2 mt-1">
                                    <p className="text-gray-500 text-sm">
                                        ID: {transaction.id}
                                    </p>
                                    {transaction.cheque && (
                                        <div>
                                            {renderStatusBadge(transaction.status, true)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-2xl font-bold ${transaction.tx_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(transaction.amount)}
                                </div>
                                <div className="text-gray-500 text-sm">
                                    {formatDate(transaction.tx_date)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transaction details - with card styling */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-medium text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center">
                                <FaInfoCircle className="mr-2 text-blue-500" />
                                Transaction Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-500 text-sm">Type</p>
                                    <p className="text-gray-900 font-medium mt-1">{renderTransactionType(transaction.tx_type)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Payment Method</p>
                                    <p className="text-gray-900 font-medium mt-1">{renderCashType(transaction.cash_type)}</p>
                                </div>

                                {/* Payment breakdown - for transactions with both cash and bank */}
                                {transaction.cash_type === 'multiple' && (
                                    <>
                                        <div>
                                            <p className="text-gray-500 text-sm">Cash Amount</p>
                                            <p className="text-gray-900 font-medium mt-1">{formatCurrency(transaction.cash_amount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-sm">Bank Amount</p>
                                            <p className="text-gray-900 font-medium mt-1">{formatCurrency(transaction.bank_amount)}</p>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <p className="text-gray-500 text-sm">Transaction Date</p>
                                    <p className="text-gray-900 font-medium mt-1">{formatDate(transaction.tx_date)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Status</p>
                                    <p className="text-gray-900 font-medium mt-1">
                                        {renderStatusBadge(transaction.status)}
                                    </p>
                                </div>

                                {transaction.receipt_no && (
                                    <div className="col-span-2">
                                        <p className="text-gray-500 text-sm">Receipt Number</p>
                                        <p className="text-gray-900 font-medium mt-1">
                                            {transaction.booklet?.prefix || ''}
                                            {transaction.receipt_no.toString().padStart(transaction.booklet?.digit_length || 4, '0')}
                                        </p>
                                    </div>
                                )}

                                {transaction.description && (
                                    <div className="col-span-2">
                                        <p className="text-gray-500 text-sm">Description</p>
                                        <p className="text-gray-900 font-medium mt-1">{transaction.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-medium text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center">
                                <FaInfoCircle className="mr-2 text-blue-500" />
                                Account Information
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-500 text-sm">Account</p>
                                    <p className="text-gray-900 font-medium mt-1">{transaction.account?.name || 'Unknown Account'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Primary Ledger Head</p>
                                    <p className="text-gray-900 font-medium mt-1">{transaction.ledgerHead?.name || 'Unknown Ledger Head'}</p>
                                </div>
                                {transaction.donor && (
                                    <div>
                                        <p className="text-gray-500 text-sm">Donor</p>
                                        <div className="text-gray-900 font-medium mt-1">
                                            <div>{transaction.donor.name}</div>
                                            {transaction.donor.phone && <div className="text-xs text-gray-500 mt-0.5">{transaction.donor.phone}</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cheque Details Section */}
                    {transaction.cheque && (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-medium text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center">
                                <FaMoneyCheck className="mr-2 text-blue-500" />
                                Cheque Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-gray-500 text-sm">Cheque Number</p>
                                    <p className="text-gray-900 font-medium mt-1">{transaction.cheque.cheque_number}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Bank Name</p>
                                    <p className="text-gray-900 font-medium mt-1">{transaction.cheque.bank_name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Status</p>
                                    <p className="text-gray-900 font-medium mt-1">{renderStatusBadge(transaction.status, true)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Issue Date</p>
                                    <p className="text-gray-900 font-medium mt-1">{formatDate(transaction.cheque.issue_date)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Due Date</p>
                                    <p className="text-gray-900 font-medium mt-1">{formatDate(transaction.cheque.due_date)}</p>
                                </div>
                                {transaction.cheque.clearing_date && (
                                    <div>
                                        <p className="text-gray-500 text-sm">Clearing Date</p>
                                        <p className="text-gray-900 font-medium mt-1">{formatDate(transaction.cheque.clearing_date)}</p>
                                    </div>
                                )}
                                {transaction.cheque.description && (
                                    <div className="col-span-3">
                                        <p className="text-gray-500 text-sm">Notes</p>
                                        <p className="text-gray-900 font-medium mt-1">{transaction.cheque.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Transaction Items Table */}
                    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="text-lg font-medium text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center">
                            <FaTable className="mr-2 text-blue-500" />
                            Transaction Items
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border border-gray-100 rounded overflow-hidden">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Ledger Head
                                        </th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Type
                                        </th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {transaction.items.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                {item.ledgerHead?.name || `Ledger #${item.ledger_head_id}`}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                {item.side === '+' ? (
                                                    <span className="text-green-600 font-medium">Credit</span>
                                                ) : (
                                                    <span className="text-red-600 font-medium">Debit</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                                                {formatCurrency(item.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-medium">
                                        <td colSpan="2" className="px-4 py-3 text-right text-sm text-gray-800">Total</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(transaction.amount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Delete confirmation modal */}
                    {showDeleteConfirm && (
                        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
                            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowDeleteConfirm(false)}></div>
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
                                            onClick={() => setShowDeleteConfirm(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md focus:outline-none"
                                            onClick={handleDelete}
                                        >
                                            Yes, Void Transaction
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm text-center">
                    <FaExclamationTriangle className="text-yellow-500 text-5xl mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Transaction Not Found</h3>
                    <p className="text-gray-500 mb-4">
                        The transaction you're looking for could not be found. It may have been deleted or does not exist.
                    </p>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none"
                    >
                        Return to Transactions
                    </button>
                </div>
            )}
        </div>
    );
} 