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
    FaEdit
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
        const date = new Date(dateString);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    // Render cash type badge
    const renderCashType = (cashType) => {
        let icon;
        let colorClass;

        switch (cashType) {
            case 'cash':
                icon = <FaMoneyBillWave className="mr-1" />;
                colorClass = 'bg-green-100 text-green-800';
                break;
            case 'bank':
                icon = <FaUniversity className="mr-1" />;
                colorClass = 'bg-blue-100 text-blue-800';
                break;
            case 'upi':
                icon = <FaMobileAlt className="mr-1" />;
                colorClass = 'bg-purple-100 text-purple-800';
                break;
            case 'card':
                icon = <FaCreditCard className="mr-1" />;
                colorClass = 'bg-indigo-100 text-indigo-800';
                break;
            case 'netbank':
                icon = <FaUniversity className="mr-1" />;
                colorClass = 'bg-cyan-100 text-cyan-800';
                break;
            case 'cheque':
                icon = <FaFileInvoice className="mr-1" />;
                colorClass = 'bg-yellow-100 text-yellow-800';
                break;
            default:
                icon = <FaMoneyBillWave className="mr-1" />;
                colorClass = 'bg-gray-100 text-gray-800';
        }

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                {icon}
                {cashType.toUpperCase()}
            </span>
        );
    };

    // Render transaction type badge
    const renderTransactionType = (txType) => {
        if (txType === 'credit') {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FaArrowDown className="mr-1" />
                    CREDIT
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <FaArrowUp className="mr-1" />
                    DEBIT
                </span>
            );
        }
    };

    return (
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            {/* Error message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start">
                    <FaExclamationTriangle className="text-red-500 mr-3 mt-1 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold mb-1">Error</h3>
                        <p>{error}</p>
                        <button
                            onClick={fetchTransaction}
                            className="text-red-600 hover:text-red-800 mt-2 underline text-sm"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* Loading state */}
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
                                    className="px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-700 flex items-center font-medium transition-colors shadow-sm"
                                    onClick={() => window.open(`${API_CONFIG.API_PREFIX}/transactions/${transactionId}/receipt`, '_blank')}
                                >
                                    <FaPrint className="mr-1.5" />
                                    Print Receipt
                                </button>
                            )}

                            <button
                                className="px-4 py-2 bg-green-100 hover:bg-green-200 rounded-lg text-green-700 flex items-center font-medium transition-colors shadow-sm"
                                onClick={() => onEditTransaction(transaction)}
                            >
                                <FaEdit className="mr-1.5" />
                                Edit Transaction
                            </button>

                            <button
                                className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-red-700 flex items-center font-medium transition-colors shadow-sm"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <FaTrash className="mr-1.5" />
                                Void Transaction
                            </button>
                        </div>
                    </div>

                    {/* Transaction header - with improved card styling */}
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
                                <p className="text-gray-500 text-sm mt-1">
                                    ID: {transaction.id}
                                </p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-medium text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center">
                                <FaUniversity className="mr-2 text-blue-500" />
                                Account Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-500 text-sm">Account</p>
                                    <p className="text-gray-900 font-medium">{transaction.account?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Ledger Head</p>
                                    <p className="text-gray-900 font-medium">{transaction.ledgerHead?.name || 'Multiple Ledger Heads'}</p>
                                </div>
                                {transaction.donor && (
                                    <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                                        <p className="text-gray-500 text-sm">Donor</p>
                                        <p className="text-gray-900 font-medium">{transaction.donor.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>

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
                                {transaction.cash_type === 'both' || transaction.cash_type === 'multiple' ? (
                                    <>
                                        <div>
                                            <p className="text-gray-500 text-sm">Cash Amount</p>
                                            <p className="text-gray-900 font-medium">
                                                {formatCurrency(transaction.cash_amount || 0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-sm">Bank Amount</p>
                                            <p className="text-gray-900 font-medium">
                                                {formatCurrency(transaction.bank_amount || 0)}
                                            </p>
                                        </div>
                                    </>
                                ) : transaction.cash_type === 'cash' ? (
                                    <div className="col-span-2">
                                        <p className="text-gray-500 text-sm">Cash Amount</p>
                                        <p className="text-gray-900 font-medium">
                                            {formatCurrency(transaction.cash_amount || transaction.amount || 0)}
                                        </p>
                                    </div>
                                ) : transaction.cash_type === 'bank' ? (
                                    <div className="col-span-2">
                                        <p className="text-gray-500 text-sm">Bank Amount</p>
                                        <p className="text-gray-900 font-medium">
                                            {formatCurrency(transaction.bank_amount || transaction.amount || 0)}
                                        </p>
                                    </div>
                                ) : null}

                                {transaction.tx_type === 'credit' && (
                                    <>
                                        <div>
                                            <p className="text-gray-500 text-sm">Booklet</p>
                                            {transaction.booklet ? (
                                                <p className="text-gray-900 font-medium">{transaction.booklet.booklet_no}</p>
                                            ) : (
                                                <p className="text-gray-500 italic text-sm">(detached from booklet)</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-sm">Receipt No.</p>
                                            <p className="text-gray-900 font-medium">{transaction.receipt_no || 'N/A'}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Additional info */}
                    {transaction.description && (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow mb-6">
                            <h3 className="text-lg font-medium text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center">
                                <FaFile className="mr-2 text-blue-500" />
                                Description
                            </h3>
                            <p className="text-gray-700">{transaction.description}</p>
                        </div>
                    )}

                    {/* Split details if available */}
                    {transaction.items && transaction.items.length > 0 && (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-medium text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center">
                                <FaReceipt className="mr-2 text-blue-500" />
                                {transaction.items.length > 1 ? 'Split Transactions' : 'Transaction Entry'}
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ledger Head</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
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
                    )}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-gray-400 text-lg mb-3">Transaction not found</div>
                    <p className="text-gray-500 text-sm">This transaction may have been deleted or does not exist.</p>
                    <button
                        onClick={onBack}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                        Go Back to Transactions
                    </button>
                </div>
            )}

            {/* Delete confirmation modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full border border-gray-200 shadow-lg">
                        <h3 className="text-xl font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Void Transaction</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to void this transaction? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                {loading ?
                                    <span className="flex items-center">
                                        <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-white rounded-full"></div>
                                        Processing...
                                    </span> :
                                    "Void Transaction"
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 