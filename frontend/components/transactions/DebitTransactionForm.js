import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaSave,
    FaTimes,
    FaPlus,
    FaTrash,
    FaMoneyBillWave,
    FaUniversity,
    FaExclamationTriangle
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

export default function DebitTransactionForm({ onSuccess, onCancel, transaction = null, isEditing = false }) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Form data
    const [formData, setFormData] = useState({
        account_id: '',
        ledger_head_id: '',
        amount: '',
        cash_type: 'cash',
        tx_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
        description: '',
        splits: []
    });

    // Form validation errors
    const [errors, setErrors] = useState({});

    // Split mode
    const [useSplits, setUseSplits] = useState(false);

    // Options for dropdowns
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

    // Fetch form data
    const fetchFormData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [accountsRes, ledgerHeadsRes] = await Promise.all([
                api.get('/api/accounts'),
                api.get('/api/ledger-heads')
            ]);

            setAccounts(accountsRes.data.data || []);
            setLedgerHeads(ledgerHeadsRes.data.data || []);

            // If editing, initialize form with transaction data
            if (isEditing && transaction) {
                console.log('Initializing form with transaction data for editing:', transaction);

                // Check if this is a split transaction by looking for transaction items
                const hasSplits = transaction.items && transaction.items.length > 1;
                setUseSplits(hasSplits);

                // Get splits from transaction items
                let splits = [];
                if (hasSplits) {
                    // All items except the target ledger head are source splits
                    splits = transaction.items
                        .filter(item => item.side === '-')
                        .map(item => ({
                            ledger_head_id: item.ledger_head_id.toString(),
                            amount: item.amount.toString()
                        }));
                }

                setFormData({
                    id: transaction.id,
                    account_id: transaction.account_id?.toString() || '',
                    ledger_head_id: transaction.ledger_head_id?.toString() || '',
                    amount: transaction.amount?.toString() || '',
                    cash_type: transaction.cash_type || 'cash',
                    tx_date: transaction.tx_date || new Date().toISOString().split('T')[0],
                    description: transaction.description || '',
                    splits: splits.length > 0 ? splits : [{ ledger_head_id: '', amount: '' }]
                });
            } else if (accountsRes.data.data.length > 0) {
                // Default account selection for new transactions
                const defaultAccount = accountsRes.data.data[0].id;
                const accountLedgerHeads = ledgerHeadsRes.data.data.filter(
                    head => head.account_id === defaultAccount
                );

                    setFormData(prev => ({
                        ...prev,
                    account_id: defaultAccount,
                    ledger_head_id: accountLedgerHeads.length > 0 ? accountLedgerHeads[0].id : ''
                    }));
            }

            setLoading(false);
        } catch (err) {
            console.error('Error fetching form data:', err);
            setError('Failed to load form data. Please try again.');
            setLoading(false);
        }
    };

    // Load data on component mount
    useEffect(() => {
        fetchFormData();
    }, []);

    // Filter ledger heads based on selected account
    const filteredLedgerHeads = ledgerHeads.filter(
        head => head.account_id === formData.account_id
    );

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Special handling for account_id (reset ledger_head_id)
        if (name === 'account_id') {
            const accountLedgerHeads = ledgerHeads.filter(
                head => head.account_id === value
            );

            setFormData(prev => ({
                ...prev,
                [name]: value,
                ledger_head_id: accountLedgerHeads.length > 0 ? accountLedgerHeads[0].id : ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: name === 'amount' ? (value === '' ? '' : parseFloat(value)) : value
            }));
        }

        // Clear validation error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    // Toggle split mode
    const toggleSplitMode = () => {
        if (useSplits) {
            // Clear splits when disabling
            setFormData(prev => ({
                ...prev,
                splits: []
            }));
        } else {
            // Add initial split when enabling
            setFormData(prev => ({
                ...prev,
                splits: [{ ledger_head_id: '', amount: '' }]
            }));
        }

        setUseSplits(!useSplits);
    };

    // Add a new split
    const addSplit = () => {
        setFormData(prev => ({
            ...prev,
            splits: [
                ...prev.splits,
                { ledger_head_id: '', amount: '' }
            ]
        }));
    };

    // Remove a split
    const removeSplit = (index) => {
        setFormData(prev => {
            const newSplits = [...prev.splits];
            newSplits.splice(index, 1);
            return {
                ...prev,
                splits: newSplits
            };
        });

        // Clear any errors for this split
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`splits[${index}].ledger_head_id`];
            delete newErrors[`splits[${index}].amount`];
            return newErrors;
        });
    };

    // Update a split
    const updateSplit = (index, field, value) => {
        setFormData(prev => {
            const newSplits = [...prev.splits];
            newSplits[index] = {
                ...newSplits[index],
                [field]: field === 'amount' ? (value === '' ? '' : parseFloat(value)) : value
            };
            return {
                ...prev,
                splits: newSplits
            };
        });

        // Clear validation error for this field
        if (errors[`splits[${index}].${field}`]) {
            setErrors(prev => ({
                ...prev,
                [`splits[${index}].${field}`]: null
            }));
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        // Required fields
        if (!formData.account_id) newErrors.account_id = 'Account is required';
        if (!formData.ledger_head_id) newErrors.ledger_head_id = 'Ledger head is required';
        if (!formData.tx_date) newErrors.tx_date = 'Date is required';

        // Amount validation
        if (!formData.amount) {
            newErrors.amount = 'Amount is required';
        } else if (isNaN(formData.amount) || formData.amount <= 0) {
            newErrors.amount = 'Amount must be greater than zero';
        }

        // Validate splits if enabled
        if (useSplits && formData.splits.length > 0) {
            let totalSplitAmount = 0;

            formData.splits.forEach((split, index) => {
                if (!split.ledger_head_id) {
                    newErrors[`splits[${index}].ledger_head_id`] = 'Ledger head is required';
                }

                if (!split.amount) {
                    newErrors[`splits[${index}].amount`] = 'Amount is required';
                } else if (isNaN(split.amount) || split.amount <= 0) {
                    newErrors[`splits[${index}].amount`] = 'Amount must be greater than zero';
                } else {
                    totalSplitAmount += parseFloat(split.amount);
                }
            });

            // Check if split total matches the main amount
            if (totalSplitAmount !== parseFloat(formData.amount)) {
                newErrors.splits = `Split total (${formatCurrency(totalSplitAmount)}) does not match the transaction amount (${formatCurrency(formData.amount)})`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Format currency amounts with Indian Rupee symbol
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Calculate total amount from splits
    const calculateSplitTotal = () => {
        if (!formData.splits || formData.splits.length === 0) return 0;
        return formData.splits.reduce((total, split) => {
            return total + (parseFloat(split.amount) || 0);
        }, 0);
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        if (!validateForm()) {
            // Scroll to the first error
            const firstErrorElement = document.querySelector('.error-message');
            if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            // Prepare transaction data
            const transactionData = {
                account_id: parseInt(formData.account_id),
                ledger_head_id: !useSplits ? parseInt(formData.ledger_head_id) : null,
                amount: parseFloat(formData.amount),
                tx_type: 'debit',
                cash_type: formData.cash_type,
                tx_date: formData.tx_date,
                description: formData.description || null,
                splits: useSplits ? formData.splits.map(split => ({
                    ledger_head_id: parseInt(split.ledger_head_id),
                    amount: parseFloat(split.amount),
                    side: '-'
                })) : []
            };

            let response;

            if (isEditing) {
                // Update existing transaction
                console.log(`Updating transaction ${formData.id}...`);
                response = await api.put(`/api/transactions/${formData.id}`, transactionData);

            if (response.data && response.data.success) {
                // Call onSuccess callback
                if (onSuccess) {
                        onSuccess(response.data.transaction || response.data.data);
                    }
                    // Show success message
                    toast.success('Transaction updated successfully', {
                        position: "top-right",
                        autoClose: 3000
                    });
                } else {
                    setError(response.data.message || 'Failed to update transaction');
                }
            } else {
                // Create new transaction
                console.log('Creating new transaction...');
                response = await api.post('/api/transactions', transactionData);

                if (response.data && response.data.success) {
                    // Call onSuccess callback
                    if (onSuccess) {
                        onSuccess(response.data.transaction || response.data.data);
                    }
                    // Show success message
                    toast.success('Transaction created successfully', {
                        position: "top-right",
                        autoClose: 3000
                    });
            } else {
                setError(response.data.message || 'Failed to create transaction');
                }
            }
        } catch (err) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} transaction:`, err);

            if (err.response && err.response.data) {
                setError(err.response.data.message || `Error: ${err.response.status}`);
            } else {
                setError(`Failed to ${isEditing ? 'update' : 'create'} transaction: ${err.message}`);
            }

            // Show error toast
            toast.error(`Error: ${err.response?.data?.message || err.message}`, {
                position: "top-right",
                autoClose: 5000
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Render form UI
    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <FaMoneyBillWave className="mr-2 text-purple-500" />
                    {isEditing ? 'Edit Debit Transaction' : 'New Debit Transaction'}
                </h2>
                <p className="text-gray-500 mt-1 text-sm">
                    {isEditing
                        ? 'Edit the details of an existing debit transaction'
                        : 'Create a new debit transaction by filling out the form below'
                    }
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 flex items-start">
                    <FaExclamationTriangle className="text-red-500 mr-3 mt-1 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold mb-1">Error</h3>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {/* Loading state */}
            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <div className="text-blue-400">Loading form data...</div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Account selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Account *</label>
                            <select
                                name="account_id"
                                value={formData.account_id}
                                onChange={handleInputChange}
                                className={`bg-gray-700 text-white border ${errors.account_id ? 'border-red-500' : 'border-gray-600'} rounded-lg p-2.5 w-full`}
                                disabled={submitting}
                            >
                                <option value="">Select Account</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                            {errors.account_id && <p className="text-red-500 text-xs mt-1 error-message">{errors.account_id}</p>}
                        </div>

                        {/* Ledger Head selection (conditional based on split mode) */}
                        {!useSplits && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Ledger Head *</label>
                                <select
                                    name="ledger_head_id"
                                    value={formData.ledger_head_id}
                                    onChange={handleInputChange}
                                    className={`bg-gray-700 text-white border ${errors.ledger_head_id ? 'border-red-500' : 'border-gray-600'} rounded-lg p-2.5 w-full`}
                                    disabled={submitting || !formData.account_id}
                                >
                                    <option value="">Select Ledger Head</option>
                                    {filteredLedgerHeads.map(head => (
                                        <option key={head.id} value={head.id}>
                                            {head.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.ledger_head_id && <p className="text-red-500 text-xs mt-1 error-message">{errors.ledger_head_id}</p>}
                            </div>
                        )}

                        {/* Transaction Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Amount (₹) *</label>
                            <input
                                type="number"
                                name="amount"
                                value={formData.amount}
                                onChange={handleInputChange}
                                className={`bg-gray-700 text-white border ${errors.amount ? 'border-red-500' : 'border-gray-600'} rounded-lg p-2.5 w-full`}
                                min="0.01"
                                step="0.01"
                                disabled={submitting}
                            />
                            {errors.amount && <p className="text-red-500 text-xs mt-1 error-message">{errors.amount}</p>}
                        </div>

                        {/* Cash Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Payment Method *</label>
                            <select
                                name="cash_type"
                                value={formData.cash_type}
                                onChange={handleInputChange}
                                className="bg-gray-700 text-white border border-gray-600 rounded-lg p-2.5 w-full"
                                disabled={submitting}
                            >
                                <option value="cash">Cash</option>
                                <option value="bank">Bank Transfer</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card Payment</option>
                                <option value="netbank">Net Banking</option>
                                <option value="cheque">Cheque</option>
                            </select>
                        </div>

                        {/* Transaction Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
                            <input
                                type="date"
                                name="tx_date"
                                value={formData.tx_date}
                                onChange={handleInputChange}
                                className={`bg-gray-700 text-white border ${errors.tx_date ? 'border-red-500' : 'border-gray-600'} rounded-lg p-2.5 w-full`}
                                disabled={submitting}
                            />
                            {errors.tx_date && <p className="text-red-500 text-xs mt-1 error-message">{errors.tx_date}</p>}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows="3"
                            className="bg-gray-700 text-white border border-gray-600 rounded-lg p-2.5 w-full"
                            disabled={submitting}
                        ></textarea>
                    </div>

                    {/* Split Transaction Option */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                type="button"
                                onClick={toggleSplitMode}
                                className={`flex items-center px-4 py-2 rounded-lg mr-3 ${useSplits ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                disabled={submitting}
                            >
                                {useSplits ? <FaTimes className="mr-2" /> : <FaPlus className="mr-2" />}
                                {useSplits ? 'Disable Split' : 'Enable Split Transaction'}
                            </button>
                            <p className="text-sm text-gray-400">
                                {useSplits
                                    ? 'Distribute this transaction across multiple ledger heads'
                                    : 'Split this transaction across multiple ledger heads'}
                            </p>
                        </div>
                    </div>

                    {/* Split Transaction Items */}
                    {useSplits && (
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center">
                                <FaMoneyBillWave className="mr-2" />
                                Split Transaction
                            </h3>

                            {errors.splits && (
                                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
                                    {errors.splits}
                                </div>
                            )}

                            <div className="space-y-4">
                                {formData.splits.map((split, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-4 items-start">
                                        <div className="col-span-6">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Ledger Head *
                                            </label>
                                            <select
                                                value={split.ledger_head_id}
                                                onChange={(e) => updateSplit(index, 'ledger_head_id', e.target.value)}
                                                className={`bg-gray-600 text-white border ${errors[`splits[${index}].ledger_head_id`] ? 'border-red-500' : 'border-gray-500'} rounded-lg p-2.5 w-full`}
                                                disabled={submitting}
                                            >
                                                <option value="">Select Ledger Head</option>
                                                {filteredLedgerHeads.map(head => (
                                                    <option key={head.id} value={head.id}>
                                                        {head.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors[`splits[${index}].ledger_head_id`] && (
                                                <p className="text-red-500 text-xs mt-1 error-message">
                                                    {errors[`splits[${index}].ledger_head_id`]}
                                                </p>
                                            )}
                                        </div>

                                        <div className="col-span-4">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Amount *
                                            </label>
                                            <input
                                                type="number"
                                                value={split.amount}
                                                onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                                                className={`bg-gray-600 text-white border ${errors[`splits[${index}].amount`] ? 'border-red-500' : 'border-gray-500'} rounded-lg p-2.5 w-full`}
                                                min="0.01"
                                                step="0.01"
                                                disabled={submitting}
                                            />
                                            {errors[`splits[${index}].amount`] && (
                                                <p className="text-red-500 text-xs mt-1 error-message">
                                                    {errors[`splits[${index}].amount`]}
                                                </p>
                                            )}
                                        </div>

                                        <div className="col-span-2 flex pt-8">
                                            {index === 0 && formData.splits.length < 5 && (
                                                <button
                                                    type="button"
                                                    onClick={addSplit}
                                                    className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center mr-2"
                                                    disabled={submitting}
                                                >
                                                    <FaPlus />
                                                </button>
                                            )}

                                            {formData.splits.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeSplit(index)}
                                                    className="h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"
                                                    disabled={submitting}
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-between pt-3 border-t border-gray-600">
                                    <span className="text-gray-300">Total Split Amount:</span>
                                    <span className={`font-semibold ${calculateSplitTotal() === parseFloat(formData.amount) ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrency(calculateSplitTotal())}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form Actions */}
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 flex items-center font-medium"
                            disabled={submitting}
                        >
                            <FaTimes className="mr-1.5" />
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white flex items-center font-medium"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-white rounded-full"></div>
                                    {isEditing ? 'Updating...' : 'Saving...'}
                                </>
                            ) : (
                                <>
                                    <FaSave className="mr-1.5" />
                                    {isEditing ? 'Update Transaction' : 'Save Transaction'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
} 