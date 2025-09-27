import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    FaSave,
    FaTimes,
    FaMoneyBillWave,
    FaUniversity,
    FaExclamationTriangle,
    FaSearch,
    FaCalendarAlt,
    FaExchangeAlt,
    FaMoneyCheck,
    FaHashtag,
    FaInfoCircle,
    FaSpinner
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
        source_ledger_head_id: '', // Credit ledger head (source of funds)
        ledger_head_id: '',        // Debit ledger head (destination)
        amount: '',
        cash_amount: '',
        bank_amount: '',
        cash_type: 'cash',         // Now can be: cash, bank, multiple, or cheque
        tx_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
        description: '',
        voucher_number: '',
        manual_voucher: false,
        cheque_number: '',
        bank_name: '',
        issue_date: '',
        due_date: ''
    });

    // Form validation errors
    const [errors, setErrors] = useState({});

    // Options for dropdowns
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [balances, setBalances] = useState({});

    // UI state
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);

        // Use global axios instance with auth interceptors
    const api = axios;

    useEffect(() => {
        initializeForm();
    }, []);

    const initializeForm = async () => {
        try {
            setLoading(true);
            await fetchAccounts();

            // If editing, populate form
            if (isEditing && transaction) {
                setFormData({
                    account_id: transaction.account_id || '',
                    source_ledger_head_id: transaction.source_ledger_head_id || '',
                    ledger_head_id: transaction.ledger_head_id || '',
                    amount: transaction.amount || '',
                    cash_amount: transaction.cash_amount || '',
                    bank_amount: transaction.bank_amount || '',
                    cash_type: transaction.cash_type || 'cash',
                    tx_date: transaction.tx_date || new Date().toISOString().split('T')[0],
                    description: transaction.description || '',
                    voucher_number: transaction.voucher_number || '',
                    manual_voucher: transaction.manual_voucher || false,
                    cheque_number: transaction.cheque_number || '',
                    bank_name: transaction.bank_name || '',
                    issue_date: transaction.issue_date || '',
                    due_date: transaction.due_date || ''
                });

                if (transaction.account_id) {
                    await fetchLedgerHeads(transaction.account_id);
                    await fetchBalancesForDate(transaction.account_id, transaction.tx_date);
                }
            }
        } catch (error) {
            console.error('Error initializing form:', error);
            toast.error('Failed to load form data');
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const response = await api.get(`${API_CONFIG.API_PREFIX}/accounts`);
            if (response.data.success) {
                setAccounts(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchLedgerHeads = async (accountId) => {
        try {
            // Get all ledger heads since they contain the correct current_balance, cash_balance, and bank_balance
            const response = await api.get(`${API_CONFIG.API_PREFIX}/ledger-heads`);
            if (response.data.success) {
                const allLedgers = response.data.data || [];

                // Filter ledgers for the selected account if needed
                const ledgers = accountId ?
                    allLedgers.filter(ledger => ledger.account_id == accountId) :
                    allLedgers;

                setLedgerHeads(ledgers);

                // Set balances with cash and bank details from ALL ledgers
                const balanceMap = {};
                allLedgers.forEach(ledger => {
                    balanceMap[ledger.id] = {
                        current_balance: parseFloat(ledger.current_balance || 0),
                        cash_balance: parseFloat(ledger.cash_balance || 0),
                        bank_balance: parseFloat(ledger.bank_balance || 0)
                    };
                });
                setBalances(balanceMap);
            }
        } catch (error) {
            console.error('Error fetching ledger heads:', error);
        }
    };

    const fetchBalancesForDate = async (accountId, date) => {
        try {
            // Get balances directly from ledger heads since they now have correct balances
            const balanceMap = {};
            ledgerHeads.forEach(ledger => {
                balanceMap[ledger.id] = {
                    current_balance: parseFloat(ledger.current_balance || 0),
                    cash_balance: parseFloat(ledger.cash_balance || 0),
                    bank_balance: parseFloat(ledger.bank_balance || 0)
                };
            });
            setBalances(balanceMap);
        } catch (error) {
            console.error('Error setting balances:', error);
        }
    };

    // Basic date validation - only prevent future dates
    const validateDate = (date) => {
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (selectedDate > today) {
            setErrors(prev => ({ ...prev, tx_date: 'Future transaction dates are not allowed' }));
            return false;
        }

        setErrors(prev => ({ ...prev, tx_date: '' }));
        return true;
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setFormData(prev => ({ ...prev, [name]: newValue }));

        // Clear errors
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Handle date changes
        if (name === 'tx_date' && value) {
            validateDate(value);
            if (formData.account_id) {
                fetchBalancesForDate(formData.account_id, value);
            }
        }

        // Handle account changes
        if (name === 'account_id' && value) {
            setFormData(prev => ({
                ...prev,
                account_id: value,
                source_ledger_head_id: '',
                ledger_head_id: ''
            }));
            setLedgerHeads([]);
            setBalances({});
            fetchLedgerHeads(value); // This will now also set balances
        }

        // Clear amount fields when cash_type changes
        if (name === 'cash_type') {
            setFormData(prev => ({
                ...prev,
                cash_amount: '',
                bank_amount: '',
                cheque_number: '',
                bank_name: '',
                issue_date: '',
                due_date: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.tx_date) newErrors.tx_date = 'Transaction date is required';
        if (!formData.account_id) newErrors.account_id = 'Account is required';
        if (!formData.source_ledger_head_id) newErrors.source_ledger_head_id = 'Source ledger head is required';
        if (!formData.ledger_head_id) newErrors.ledger_head_id = 'Destination ledger head is required';
        if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Valid amount is required';

        // Validate cash type specific fields
        const updatedFormData = { ...formData };

        if (formData.cash_type === 'cash') {
            updatedFormData.cash_amount = formData.amount;
            updatedFormData.bank_amount = '0';
        } else if (formData.cash_type === 'bank') {
            updatedFormData.bank_amount = formData.amount;
            updatedFormData.cash_amount = '0';
        } else if (formData.cash_type === 'multiple') {
            if (!formData.cash_amount || parseFloat(formData.cash_amount) < 0) {
                newErrors.cash_amount = 'Cash amount is required for multiple payment type';
            }
            if (!formData.bank_amount || parseFloat(formData.bank_amount) < 0) {
                newErrors.bank_amount = 'Bank amount is required for multiple payment type';
            }
            if (formData.cash_amount && formData.bank_amount) {
                const totalSplit = parseFloat(formData.cash_amount) + parseFloat(formData.bank_amount);
                const totalAmount = parseFloat(formData.amount);
                if (Math.abs(totalSplit - totalAmount) > 0.01) {
                    newErrors.amount = 'Cash amount + Bank amount must equal total amount';
                }
            }
        } else if (formData.cash_type === 'cheque') {
            if (!formData.cheque_number) newErrors.cheque_number = 'Cheque number is required';
            if (!formData.bank_name) newErrors.bank_name = 'Bank name is required';
            if (!formData.issue_date) newErrors.issue_date = 'Issue date is required';
            if (!formData.due_date) newErrors.due_date = 'Due date is required';
            updatedFormData.bank_amount = formData.amount;
            updatedFormData.cash_amount = '0';
        }

        // Update formData with calculated amounts
        setFormData(updatedFormData);

        // Check source ledger balance with proper cash/bank breakdown validation
        if (formData.source_ledger_head_id && formData.amount) {
            const sourceBalanceData = balances[formData.source_ledger_head_id] || {
                current_balance: 0,
                cash_balance: 0,
                bank_balance: 0
            };

            const transferAmount = parseFloat(formData.amount);

            // Check total balance first
            if (transferAmount > sourceBalanceData.current_balance) {
                newErrors.amount = `Insufficient total balance. Available: ₹${sourceBalanceData.current_balance.toFixed(2)}`;
            } else {
                // Check cash/bank specific balances based on payment method
                if (formData.cash_type === 'cash') {
                    if (transferAmount > sourceBalanceData.cash_balance) {
                        newErrors.amount = `Insufficient cash balance. Available: ₹${sourceBalanceData.cash_balance.toFixed(2)}`;
                    }
                } else if (formData.cash_type === 'bank') {
                    if (transferAmount > sourceBalanceData.bank_balance) {
                        newErrors.amount = `Insufficient bank balance. Available: ₹${sourceBalanceData.bank_balance.toFixed(2)}`;
                    }
                } else if (formData.cash_type === 'multiple') {
                    const cashAmount = parseFloat(formData.cash_amount || 0);
                    const bankAmount = parseFloat(formData.bank_amount || 0);

                    if (cashAmount > sourceBalanceData.cash_balance) {
                        newErrors.cash_amount = `Insufficient cash balance. Available: ₹${sourceBalanceData.cash_balance.toFixed(2)}`;
                    }
                    if (bankAmount > sourceBalanceData.bank_balance) {
                        newErrors.bank_amount = `Insufficient bank balance. Available: ₹${sourceBalanceData.bank_balance.toFixed(2)}`;
                    }
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Please fix the validation errors');
            return;
        }

        setSubmitting(true);

        try {
            // Prepare submission data
            // Prepare submission data with proper cash/bank amounts
            const submitData = { ...formData };
            const totalAmount = parseFloat(formData.amount);

            // Ensure cash and bank amounts are properly set based on payment method
            if (formData.cash_type === 'cash') {
                submitData.cash_amount = totalAmount;
                submitData.bank_amount = 0;
            } else if (formData.cash_type === 'bank') {
                submitData.cash_amount = 0;
                submitData.bank_amount = totalAmount;
            } else if (formData.cash_type === 'multiple') {
                submitData.cash_amount = parseFloat(formData.cash_amount || 0);
                submitData.bank_amount = parseFloat(formData.bank_amount || 0);
            } else if (formData.cash_type === 'cheque') {
                submitData.cash_amount = 0;
                submitData.bank_amount = totalAmount;
            }

            console.log('Submitting debit transaction:', submitData);

            const endpoint = isEditing
                ? `${API_CONFIG.API_PREFIX}/transactions/${transaction.id}`
                : `${API_CONFIG.API_PREFIX}/transactions/debit`;

            const method = isEditing ? 'PUT' : 'POST';

            const response = await api.request({
                method,
                url: endpoint,
                data: submitData
            });

            if (response.data.success) {
                toast.success(isEditing ? 'Transaction updated successfully' : 'Debit transaction created successfully');
                if (onSuccess) onSuccess(response.data.data);
            } else {
                toast.error(response.data.message || 'Failed to save transaction');
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
            toast.error(error.response?.data?.message || 'Failed to save transaction');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredLedgerHeads = ledgerHeads.filter(ledger =>
        ledger.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <FaSpinner className="animate-spin text-2xl text-blue-600" />
                <span className="ml-2">Loading form...</span>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isEditing ? 'Edit Debit Transaction' : 'New Debit Transaction'}
                </h2>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <FaTimes size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Transaction Date *</label>
                        <input
                            type="date"
                            name="tx_date"
                            value={formData.tx_date}
                            onChange={handleInputChange}
                            max={new Date().toISOString().split('T')[0]}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.tx_date ? 'border-red-500' : 'border-gray-300'
                            }`}
                            required
                        />
                        {errors.tx_date && (
                            <p className="text-red-500 text-sm mt-1">{errors.tx_date}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Account *</label>
                        <select
                            name="account_id"
                            value={formData.account_id}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.account_id ? 'border-red-500' : 'border-gray-300'
                            }`}
                            required
                        >
                            <option value="">Select an account</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name}
                                </option>
                            ))}
                        </select>
                        {errors.account_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.account_id}</p>
                        )}
                    </div>
                </div>

                {/* Ledger Head Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Source Ledger Head (From) *</label>
                        <select
                            name="source_ledger_head_id"
                            value={formData.source_ledger_head_id}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.source_ledger_head_id ? 'border-red-500' : 'border-gray-300'
                            }`}
                            required
                        >
                            <option value="">Select source ledger head</option>
                            {ledgerHeads
                                .filter(ledger => ledger.head_type === 'credit') // Only show credit heads (income sources)
                                .map((ledger) => {
                                    const balance = balances[ledger.id] || { current_balance: 0, cash_balance: 0, bank_balance: 0 };
                                    return (
                                        <option key={ledger.id} value={ledger.id}>
                                            {ledger.name} - Total: ₹{balance.current_balance.toFixed(2)} (Cash: ₹{balance.cash_balance.toFixed(2)}, Bank: ₹{balance.bank_balance.toFixed(2)})
                                        </option>
                                    );
                                })}
                        </select>
                        {errors.source_ledger_head_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.source_ledger_head_id}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Destination Ledger Head (To) *</label>
                        <select
                            name="ledger_head_id"
                            value={formData.ledger_head_id}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.ledger_head_id ? 'border-red-500' : 'border-gray-300'
                            }`}
                            required
                        >
                            <option value="">Select destination ledger head</option>
                            {ledgerHeads
                                .filter(ledger => ledger.head_type === 'debit') // Only show debit heads (expense destinations)
                                .map((ledger) => (
                                <option key={ledger.id} value={ledger.id}>
                                    {ledger.name}
                                </option>
                            ))}
                        </select>
                        {errors.ledger_head_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.ledger_head_id}</p>
                        )}
                    </div>
                </div>

                {/* Balance Display for Selected Source */}
                {formData.source_ledger_head_id && balances[formData.source_ledger_head_id] && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-800 mb-3">
                            <FaInfoCircle className="inline mr-2" />
                            Available Balance in {ledgerHeads.find(l => l.id == formData.source_ledger_head_id)?.name}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    ₹{balances[formData.source_ledger_head_id].current_balance.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-600">Total Balance</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-semibold text-blue-600">
                                    <FaMoneyBillWave className="inline mr-1" />
                                    ₹{balances[formData.source_ledger_head_id].cash_balance.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-600">Cash Available</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-semibold text-purple-600">
                                    <FaUniversity className="inline mr-1" />
                                    ₹{balances[formData.source_ledger_head_id].bank_balance.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-600">Bank Available</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Method */}
                <div>
                    <label className="block text-sm font-medium mb-3">Payment Method *</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { value: 'cash', label: 'Cash', icon: '💵' },
                            { value: 'bank', label: 'Bank', icon: '🏦' },
                            { value: 'multiple', label: 'Cash + Bank', icon: '💳' },
                            { value: 'cheque', label: 'Cheque', icon: '📝' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleInputChange({ target: { name: 'cash_type', value: option.value } })}
                                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                                    formData.cash_type === option.value
                                        ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30'
                                        : 'border-gray-300 hover:border-blue-300'
                                }`}
                            >
                                <div className="text-2xl mb-2">{option.icon}</div>
                                <div className="font-medium">{option.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Amount Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Total Amount *</label>
                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleInputChange}
                            step="0.01"
                            min="0.01"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.amount ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="0.00"
                            required
                        />
                        {errors.amount && (
                            <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
                        )}
                    </div>

                    {formData.cash_type === 'multiple' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-2">Cash Amount *</label>
                                <input
                                    type="number"
                                    name="cash_amount"
                                    value={formData.cash_amount}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.cash_amount ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="0.00"
                                />
                                {errors.cash_amount && (
                                    <p className="text-red-500 text-sm mt-1">{errors.cash_amount}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Bank Amount *</label>
                                <input
                                    type="number"
                                    name="bank_amount"
                                    value={formData.bank_amount}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.bank_amount ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="0.00"
                                />
                                {errors.bank_amount && (
                                    <p className="text-red-500 text-sm mt-1">{errors.bank_amount}</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Cheque Details */}
                {formData.cash_type === 'cheque' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Cheque Number *</label>
                            <input
                                type="text"
                                name="cheque_number"
                                value={formData.cheque_number}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.cheque_number ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Enter cheque number"
                            />
                            {errors.cheque_number && (
                                <p className="text-red-500 text-sm mt-1">{errors.cheque_number}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Bank Name *</label>
                            <input
                                type="text"
                                name="bank_name"
                                value={formData.bank_name}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.bank_name ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Enter bank name"
                            />
                            {errors.bank_name && (
                                <p className="text-red-500 text-sm mt-1">{errors.bank_name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Issue Date *</label>
                            <input
                                type="date"
                                name="issue_date"
                                value={formData.issue_date}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.issue_date ? 'border-red-500' : 'border-gray-300'
                                }`}
                            />
                            {errors.issue_date && (
                                <p className="text-red-500 text-sm mt-1">{errors.issue_date}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Due Date *</label>
                            <input
                                type="date"
                                name="due_date"
                                value={formData.due_date}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.due_date ? 'border-red-500' : 'border-gray-300'
                                }`}
                            />
                            {errors.due_date && (
                                <p className="text-red-500 text-sm mt-1">{errors.due_date}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Voucher Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Voucher Number</label>
                        <input
                            type="text"
                            name="voucher_number"
                            value={formData.voucher_number}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Auto-generated if empty"
                        />
                    </div>

                    <div className="flex items-center mt-6">
                        <input
                            type="checkbox"
                            name="manual_voucher"
                            id="manual_voucher"
                            checked={formData.manual_voucher}
                            onChange={handleInputChange}
                            className="mr-2"
                        />
                        <label htmlFor="manual_voucher" className="text-sm font-medium">
                            Manual voucher number
                        </label>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Additional notes about this transaction..."
                    />
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`px-6 py-2 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center ${
                            submitting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {submitting ? (
                            <>
                                <FaSpinner className="animate-spin mr-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <FaSave className="mr-2" />
                                {isEditing ? 'Update Transaction' : 'Save Transaction'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}