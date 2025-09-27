import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import API_CONFIG from '../../config';
import {
    FaCalendarAlt, FaMoneyBillWave, FaUniversity, FaUser, FaBook, FaEdit,
    FaClock, FaShieldAlt, FaCheckCircle, FaExclamationTriangle, FaLock,
    FaInfoCircle, FaBan, FaEye
} from 'react-icons/fa';

export default function ImmutableCreditTransactionForm({ onSuccess, onCancel }) {
    // 🚨 IMMUTABLE CACHE BUSTER VERSION: v3.1 - TIMESTAMP: 1737897700000
    console.log('🚨 ImmutableCreditTransactionForm LOADED - VERSION 3.1 - MIXED PAYMENT FIXED');

    // Form state
    const [formData, setFormData] = useState({
        account_id: '',
        ledger_head_id: '',
        booklet_id: '',
        receipt_number: '',
        donor_id: '',
        amount: '',
        cash_amount: '',
        bank_amount: '',
        cash_type: 'cash',
        transaction_date: new Date().toISOString().split('T')[0], // Default to today
        description: ''
    });

    // UI state
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [dateValidation, setDateValidation] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [booklets, setBooklets] = useState([]);
    const [selectedBooklet, setSelectedBooklet] = useState(null);
    const [availableReceipts, setAvailableReceipts] = useState([]);
    const [donors, setDonors] = useState([]);

    // Use global axios instance with auth interceptors
    const api = axios;

    // Load initial data
    useEffect(() => {
        Promise.all([
            fetchAccounts(),
            fetchBooklets(),
            fetchDonors()
        ]);
    }, []);

    // Load ledger heads when account changes
    useEffect(() => {
        if (formData.account_id) {
            fetchLedgerHeads(formData.account_id);
        }
    }, [formData.account_id]);

    // Validate date whenever it changes
    useEffect(() => {
        if (formData.transaction_date) {
            validateTransactionDate(formData.transaction_date);
        }
    }, [formData.transaction_date]);

    // Auto-calculate amounts when main amount changes or payment method changes
    useEffect(() => {
        if (formData.amount && formData.cash_type !== 'mixed') {
            const amount = parseFloat(formData.amount) || 0;

            if (formData.cash_type === 'cash') {
                setFormData(prev => ({
                    ...prev,
                    cash_amount: amount.toString(),
                    bank_amount: '0'
                }));
            } else if (formData.cash_type === 'bank') {
                setFormData(prev => ({
                    ...prev,
                    cash_amount: '0',
                    bank_amount: amount.toString()
                }));
            }
        } else if (formData.cash_type === 'mixed') {
            // For mixed, clear both fields so user can enter manually
            // Only auto-clear if both fields are currently 0
            const currentCash = parseFloat(formData.cash_amount) || 0;
            const currentBank = parseFloat(formData.bank_amount) || 0;

            if (currentCash === 0 && currentBank === 0 && formData.amount) {
                setFormData(prev => ({
                    ...prev,
                    cash_amount: '',
                    bank_amount: ''
                }));
            }
        }
    }, [formData.amount, formData.cash_type]);

    // Auto-calculate total amount when cash or bank amounts change for mixed payments
    useEffect(() => {
        if (formData.cash_type === 'mixed' && (formData.cash_amount || formData.bank_amount)) {
            const cashAmount = parseFloat(formData.cash_amount) || 0;
            const bankAmount = parseFloat(formData.bank_amount) || 0;
            const totalAmount = cashAmount + bankAmount;

            if (totalAmount > 0) {
                setFormData(prev => ({
                    ...prev,
                    amount: totalAmount.toString()
                }));
            }
        }
    }, [formData.cash_amount, formData.bank_amount, formData.cash_type]);

    // Fetch functions
    const fetchAccounts = async () => {
        try {
            const response = await api.get('/api/accounts');
            if (response.data?.success) {
                setAccounts(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchLedgerHeads = async (accountId) => {
        try {
            const response = await api.get(`/api/ledger-heads?account_id=${accountId}`);
            if (response.data?.success) {
                // Filter for credit heads only
                const creditHeads = (response.data.data || []).filter(head => head.head_type === 'credit');
                setLedgerHeads(creditHeads);

                // Reset ledger head selection if current selection is not valid
                if (formData.ledger_head_id) {
                    const isValid = creditHeads.some(head => head.id.toString() === formData.ledger_head_id);
                    if (!isValid) {
                        setFormData(prev => ({ ...prev, ledger_head_id: '' }));
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching ledger heads:', error);
        }
    };

    const fetchBooklets = async () => {
        try {
            const response = await api.get('/api/booklets');
            if (response.data?.success) {
                setBooklets(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching booklets:', error);
        }
    };

    const fetchDonors = async () => {
        try {
            const response = await api.get('/api/donors');
            if (response.data?.success) {
                setDonors(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching donors:', error);
        }
    };

    const validateTransactionDate = async (date) => {
        try {
            const response = await api.post('/api/transactions/validate-date', {
                transaction_date: date
            });

            if (response.data?.success) {
                setDateValidation(response.data.data);
            }
        } catch (error) {
            setDateValidation({
                allowed: false,
                reason: error.response?.data?.message || 'Date validation failed',
                status: 'error'
            });
        }
    };

    // Handle form changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Handle booklet selection change
        if (field === 'booklet_id') {
            const booklet = booklets.find(b => b.id.toString() === value);
            setSelectedBooklet(booklet);
            setAvailableReceipts(booklet ? booklet.pages_left || [] : []);
            // Reset receipt number when booklet changes
            setFormData(prev => ({
                ...prev,
                receipt_number: ''
            }));
        }
    };

    const handleAmountChange = (mainAmount) => {
        const amount = parseFloat(mainAmount) || 0;
        setFormData(prev => ({
            ...prev,
            amount: mainAmount,
            cash_amount: formData.cash_type === 'cash' ? mainAmount : '0',
            bank_amount: formData.cash_type === 'bank' ? mainAmount : '0'
        }));
    };

    // Form validation helper
    const isFormValid = () => {
        const hasDescription = formData.description && formData.description.trim().length >= 3;

        if (formData.cash_type === 'cash' || formData.cash_type === 'bank') {
            const mainAmount = parseFloat(formData.amount) || 0;
            return mainAmount > 0 && hasDescription;
        }

        if (formData.cash_type === 'mixed') {
            const cashAmount = parseFloat(formData.cash_amount) || 0;
            const bankAmount = parseFloat(formData.bank_amount) || 0;
            return cashAmount > 0 && bankAmount > 0 && hasDescription;
        }

        return false;
    };

    // Form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!dateValidation?.allowed) {
            toast.error('Please select a valid transaction date');
            return;
        }

        // Validate amounts for mixed payment method
        if (formData.cash_type === 'mixed') {
            const mainAmount = parseFloat(formData.amount) || 0;
            const cashAmount = parseFloat(formData.cash_amount) || 0;
            const bankAmount = parseFloat(formData.bank_amount) || 0;
            const totalAmount = cashAmount + bankAmount;

            if (Math.abs(totalAmount - mainAmount) > 0.01) {
                toast.error(`Cash amount (₹${cashAmount}) + Bank amount (₹${bankAmount}) = ₹${totalAmount} must equal Transaction amount (₹${mainAmount})`);
                return;
            }

            if (cashAmount <= 0 && bankAmount <= 0) {
                toast.error('For mixed payment, both cash and bank amounts must be greater than 0');
                return;
            }
        }

        setLoading(true);

        try {
            console.log('🔄 Submitting immutable credit transaction... CACHE BUSTER v3.1');
            console.log('📝 Original form data:', formData);
            console.log('🔍 Cash type:', formData.cash_type);

            // Process cash/bank amounts based on payment type
            const submitData = { ...formData };
            const mainAmount = parseFloat(formData.amount || 0);

            if (formData.cash_type === 'cash') {
                submitData.cash_amount = mainAmount;
                submitData.bank_amount = 0;
                console.log(`💵 CASH payment - Setting cash: ${submitData.cash_amount}, bank: ${submitData.bank_amount}`);
            } else if (formData.cash_type === 'bank') {
                submitData.cash_amount = 0;
                submitData.bank_amount = mainAmount;
                console.log(`🏦 BANK payment - Setting cash: ${submitData.cash_amount}, bank: ${submitData.bank_amount}`);
            } else if (formData.cash_type === 'mixed') {
                // CACHE BUSTER ALERT: Mixed payment processing
                console.log(`🔄 MIXED payment type detected - Processing split... TIMESTAMP: ${Date.now()}`);
                alert(`🚨 MIXED PAYMENT DETECTED! Cash: ${formData.cash_amount}, Bank: ${formData.bank_amount} - TIME: ${new Date().toLocaleTimeString()}`);
                submitData.cash_amount = parseFloat(formData.cash_amount || 0);
                submitData.bank_amount = parseFloat(formData.bank_amount || 0);
                console.log(`🔍 MIXED payment - Cash: ${submitData.cash_amount}, Bank: ${submitData.bank_amount}`);
            }

            console.log('📊 FINAL submit data before API call:', submitData);

            const response = await api.post('/api/transactions/credit', submitData);

            if (response.data?.success) {
                console.log('✅ Transaction created:', response.data.data);

                // Show success message with system info
                if (response.data.data.requires_approval) {
                    toast.success(`Transaction submitted for approval! UUID: ${response.data.data.uuid}`, {
                        duration: 5000
                    });
                } else {
                    toast.success(`Transaction created successfully! UUID: ${response.data.data.uuid}`, {
                        duration: 5000
                    });
                }

                // Show warning about immutability
                toast.custom((t) => (
                    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'}
                        max-w-md w-full bg-blue-100 border-l-4 border-blue-500 p-4 shadow-lg rounded-lg`}>
                        <div className="flex items-center">
                            <FaLock className="text-blue-500 mr-3" />
                            <div>
                                <div className="font-medium text-blue-800">Immutable Transaction System</div>
                                <div className="text-sm text-blue-600 mt-1">
                                    This transaction is now permanently recorded and cannot be edited or deleted.
                                    Only corrections through approval workflow are possible.
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 8000 });

                if (onSuccess) {
                    onSuccess(response.data.data);
                }

            } else {
                throw new Error(response.data?.message || 'Transaction creation failed');
            }

        } catch (error) {
            console.error('❌ Transaction creation failed:', error);

            const errorMessage = error.response?.data?.message || error.message || 'Transaction creation failed';
            toast.error(errorMessage, { duration: 5000 });

            // Show specific error guidance
            const errorType = error.response?.data?.error_type;
            if (errorType === 'DATE_VALIDATION_ERROR') {
                toast.error('Please check the transaction date and try again', { duration: 3000 });
            } else if (errorType === 'BACKDATE_RESTRICTION') {
                toast.error('Use correction workflow for older transactions', { duration: 3000 });
            }

        } finally {
            setLoading(false);
        }
    };

    // Step navigation
    const nextStep = () => {
        if (step < 2) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    // Get date status component
    const DateStatusIndicator = ({ validation }) => {
        if (!validation) return null;

        const statusConfig = {
            'allowed': { color: 'green', icon: <FaCheckCircle />, text: 'Current date - No approval needed' },
            'grace_period': { color: 'blue', icon: <FaClock />, text: 'Weekend grace period' },
            'needs_approval': { color: 'yellow', icon: <FaExclamationTriangle />, text: 'Manager approval required' },
            'needs_high_approval': { color: 'orange', icon: <FaShieldAlt />, text: 'Director approval required' },
            'use_correction_workflow': { color: 'red', icon: <FaBan />, text: 'Use correction workflow' },
            'error': { color: 'red', icon: <FaBan />, text: 'Invalid date' }
        };

        const config = statusConfig[validation.status] || statusConfig['error'];

        return (
            <div className={`flex items-center mt-2 text-${config.color}-600 bg-${config.color}-50 px-3 py-2 rounded-lg`}>
                {config.icon}
                <span className="ml-2 text-sm font-medium">{config.text}</span>
                {validation.approvalLevel > 0 && (
                    <span className="ml-2 text-xs bg-white px-2 py-1 rounded">
                        Level {validation.approvalLevel}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200">
            {/* Header with Security Badge */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                            <FaMoneyBillWave className="mr-3 text-green-600" />
                            New Credit Transaction
                        </h2>
                        <p className="text-gray-600 mt-1">Immutable transaction system - No edits allowed</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            <FaLock className="mr-2" />
                            Immutable System
                        </div>
                        <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            <FaShieldAlt className="mr-2" />
                            Hash Secured
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-center space-x-8">
                    {[1, 2].map((stepNum) => (
                        <div key={stepNum} className="flex items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                                step >= stepNum
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-600'
                            }`}>
                                {stepNum}
                            </div>
                            <div className="ml-3 text-sm">
                                {stepNum === 1 && 'Transaction Details'}
                                {stepNum === 2 && 'Amount & Description'}
                            </div>
                            {stepNum < 2 && (
                                <div className={`w-16 h-0.5 mx-6 ${
                                    step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
                {/* Step 1: Transaction Details */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <FaMoneyBillWave className="text-4xl text-green-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900">Transaction Details</h3>
                            <p className="text-gray-600 mt-2">Fill in the transaction information</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                            {/* Transaction Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Transaction Date *
                                </label>
                                <input
                                    type="date"
                                    value={formData.transaction_date}
                                    onChange={(e) => handleInputChange('transaction_date', e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                <DateStatusIndicator validation={dateValidation} />
                            </div>

                            {/* Account Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Account *
                                </label>
                                <select
                                    value={formData.account_id}
                                    onChange={(e) => handleInputChange('account_id', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Select Account</option>
                                    {accounts.map(account => (
                                        <option key={account.id} value={account.id}>
                                            {account.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Ledger Head */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Ledger Head *
                                </label>
                                <select
                                    value={formData.ledger_head_id}
                                    onChange={(e) => handleInputChange('ledger_head_id', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Select Ledger Head</option>
                                    {ledgerHeads.map(head => (
                                        <option key={head.id} value={head.id}>
                                            {head.name} (Credit)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Payment Method *
                                </label>
                                <div className="grid grid-cols-3 gap-4">
                                    <label className={`relative flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                                        formData.cash_type === 'cash'
                                            ? 'border-green-500 bg-green-50 shadow-md'
                                            : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="cash_type"
                                            value="cash"
                                            checked={formData.cash_type === 'cash'}
                                            onChange={(e) => handleInputChange('cash_type', e.target.value)}
                                            className="mr-3 text-green-600 focus:ring-green-500"
                                        />
                                        <FaMoneyBillWave className="mr-2 text-green-600 text-lg" />
                                        <span className="font-medium text-gray-700">Cash</span>
                                        {formData.cash_type === 'cash' && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                                        )}
                                    </label>
                                    <label className={`relative flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                                        formData.cash_type === 'bank'
                                            ? 'border-blue-500 bg-blue-50 shadow-md'
                                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="cash_type"
                                            value="bank"
                                            checked={formData.cash_type === 'bank'}
                                            onChange={(e) => handleInputChange('cash_type', e.target.value)}
                                            className="mr-3 text-blue-600 focus:ring-blue-500"
                                        />
                                        <FaUniversity className="mr-2 text-blue-600 text-lg" />
                                        <span className="font-medium text-gray-700">Bank Transfer</span>
                                        {formData.cash_type === 'bank' && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
                                        )}
                                    </label>
                                    <label className={`relative flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                                        formData.cash_type === 'mixed'
                                            ? 'border-purple-500 bg-gradient-to-br from-green-50 to-blue-50 shadow-md'
                                            : 'border-gray-200 hover:border-purple-300 hover:bg-gradient-to-br hover:from-green-50 hover:to-blue-50'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="cash_type"
                                            value="mixed"
                                            checked={formData.cash_type === 'mixed'}
                                            onChange={(e) => handleInputChange('cash_type', e.target.value)}
                                            className="mr-3 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div className="mr-2 flex">
                                            <FaMoneyBillWave className="text-green-600 text-sm" />
                                            <FaUniversity className="text-blue-600 text-sm -ml-0.5" />
                                        </div>
                                        <span className="font-medium text-gray-700">Both</span>
                                        {formData.cash_type === 'mixed' && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full"></div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            {/* Receipt Booklet */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Receipt Booklet
                                </label>
                                <select
                                    value={formData.booklet_id}
                                    onChange={(e) => handleInputChange('booklet_id', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Booklet (Optional)</option>
                                    {booklets.filter(booklet => booklet.pages_left && booklet.pages_left.length > 0).map(booklet => (
                                        <option key={booklet.id} value={booklet.id}>
                                            Booklet #{booklet.booklet_no} ({booklet.pages_left.length} receipts left)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Receipt Number Selection */}
                            {formData.booklet_id && availableReceipts.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Receipt Number *
                                    </label>
                                    <select
                                        value={formData.receipt_number}
                                        onChange={(e) => handleInputChange('receipt_number', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required={formData.booklet_id !== ''}
                                    >
                                        <option value="">Select Receipt Number</option>
                                        {availableReceipts.map(receiptNum => (
                                            <option key={receiptNum} value={receiptNum}>
                                                Receipt #{receiptNum}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {availableReceipts.length} receipts available in this booklet
                                    </p>
                                </div>
                            )}

                            {/* Donor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Donor
                                </label>
                                <select
                                    value={formData.donor_id}
                                    onChange={(e) => handleInputChange('donor_id', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Donor (Optional)</option>
                                    {donors.map(donor => (
                                        <option key={donor.id} value={donor.id}>
                                            {donor.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-center mt-8">
                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={!dateValidation?.allowed || !formData.account_id || !formData.ledger_head_id || (formData.booklet_id && !formData.receipt_number)}
                                className={`px-8 py-3 rounded-lg font-medium ${
                                    dateValidation?.allowed && formData.account_id && formData.ledger_head_id && (!formData.booklet_id || formData.receipt_number)
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Continue to Amount & Description
                            </button>
                        </div>
                    </div>
                )}


                {/* Step 2: Amount and Description */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <FaMoneyBillWave className="text-4xl text-green-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900">Amount & Description</h3>
                            <p className="text-gray-600 mt-2">Enter transaction amount and description</p>
                        </div>

                        <div className="max-w-md mx-auto space-y-6">
                            {/* Payment Method Display */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center justify-center space-x-2">
                                    {formData.cash_type === 'cash' && (
                                        <>
                                            <FaMoneyBillWave className="text-green-600 text-lg" />
                                            <span className="text-sm font-semibold text-gray-700">Cash Payment Selected</span>
                                        </>
                                    )}
                                    {formData.cash_type === 'bank' && (
                                        <>
                                            <FaUniversity className="text-blue-600 text-lg" />
                                            <span className="text-sm font-semibold text-gray-700">Bank Transfer Selected</span>
                                        </>
                                    )}
                                    {formData.cash_type === 'mixed' && (
                                        <>
                                            <div className="flex">
                                                <FaMoneyBillWave className="text-green-600 text-sm" />
                                                <FaUniversity className="text-blue-600 text-sm -ml-1" />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700">Both (Cash + Bank) Payment Selected</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Amount Input - Conditional based on payment method */}
                            {formData.cash_type === 'cash' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <FaMoneyBillWave className="inline mr-2 text-green-600" />
                                        Cash Amount *
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 text-lg">₹</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={formData.amount}
                                            onChange={(e) => handleAmountChange(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.cash_type === 'bank' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <FaUniversity className="inline mr-2 text-blue-600" />
                                        Bank Transfer Amount *
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 text-lg">₹</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={formData.amount}
                                            onChange={(e) => handleAmountChange(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.cash_type === 'mixed' && (
                                <div className="space-y-4">
                                    {/* Total Amount - Auto calculated for mixed payments */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <div className="flex items-center">
                                                <div className="flex mr-2">
                                                    <FaMoneyBillWave className="text-green-600 text-sm" />
                                                    <FaUniversity className="text-blue-600 text-sm -ml-1" />
                                                </div>
                                                Total Transaction Amount (Auto-calculated)
                                            </div>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 text-lg">₹</span>
                                            </div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.amount}
                                                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                                                placeholder="0.00"
                                                readOnly
                                            />
                                        </div>
                                    </div>

                                    {/* Amount Breakdown */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <FaMoneyBillWave className="inline mr-2 text-green-600" />
                                                Cash Amount *
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-500">₹</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={formData.cash_amount}
                                                    onChange={(e) => handleInputChange('cash_amount', e.target.value)}
                                                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                                                    placeholder="0.00"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <FaUniversity className="inline mr-2 text-blue-600" />
                                                Bank Amount *
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-500">₹</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={formData.bank_amount}
                                                    onChange={(e) => handleInputChange('bank_amount', e.target.value)}
                                                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                                                    placeholder="0.00"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Amount validation indicator for mixed payments */}
                            {formData.cash_type === 'mixed' && (formData.cash_amount || formData.bank_amount) && (() => {
                                const cashAmount = parseFloat(formData.cash_amount) || 0;
                                const bankAmount = parseFloat(formData.bank_amount) || 0;
                                const totalAmount = cashAmount + bankAmount;
                                const isValid = cashAmount > 0 && bankAmount > 0 && totalAmount > 0;

                                return (
                                    <div className={`flex items-center px-4 py-3 rounded-lg border ${
                                        isValid
                                            ? 'text-green-700 bg-green-50 border-green-200'
                                            : 'text-amber-700 bg-amber-50 border-amber-200'
                                    }`}>
                                        {isValid ? <FaCheckCircle className="mr-3" /> : <FaExclamationTriangle className="mr-3" />}
                                        <div>
                                            <div className="text-sm font-medium">
                                                {isValid
                                                    ? `✓ Total Amount: ₹${totalAmount.toFixed(2)}`
                                                    : `⚠ Please enter both cash and bank amounts`
                                                }
                                            </div>
                                            {isValid && (
                                                <div className="text-xs mt-1 opacity-75">
                                                    Cash ₹{cashAmount.toFixed(2)} + Bank ₹{bankAmount.toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Transaction Description *
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter transaction description..."
                                    required
                                    minLength={3}
                                />
                            </div>
                        </div>

                        {/* Final Warning */}
                        <div className="max-w-2xl mx-auto bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                            <div className="flex items-center">
                                <FaExclamationTriangle className="text-yellow-600 mr-3" />
                                <div>
                                    <h4 className="font-medium text-yellow-800">Final Warning - Immutable Transaction</h4>
                                    <p className="text-sm text-yellow-700 mt-2">
                                        Once created, this transaction CANNOT be edited or deleted.
                                        Only corrections through approval workflow will be possible.
                                        Please review all details carefully.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center space-x-4 mt-8">
                            <button
                                type="button"
                                onClick={prevStep}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !isFormValid()}
                                className={`px-8 py-3 rounded-lg font-medium flex items-center ${
                                    loading || !isFormValid()
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Creating Transaction...
                                    </>
                                ) : (
                                    <>
                                        <FaLock className="mr-2" />
                                        Create Immutable Transaction
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </form>

            {/* Cancel Button */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}