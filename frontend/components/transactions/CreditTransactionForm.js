import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import API_CONFIG from '../../config';
import {
    FaCalendarAlt, FaMoneyBillWave, FaUniversity, FaUser, FaBook, FaEdit,
    FaClock, FaShieldAlt, FaCheckCircle, FaExclamationTriangle, FaLock,
    FaInfoCircle, FaBan, FaEye, FaCreditCard
} from 'react-icons/fa';

export default function CreditTransactionForm({ onSuccess, onCancel }) {
    // Form state
    const [formData, setFormData] = useState({
        account_id: '',
        ledger_head_id: '',
        booklet_id: '',
        receipt_page_no: '', // Add page number field
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
    const [selectedBooklet, setSelectedBooklet] = useState(null); // Track selected booklet for page selection
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

    // Initialize cash/bank amounts based on payment method when it changes
    useEffect(() => {
        if (formData.cash_type === 'cash' && !formData.cash_amount && formData.amount) {
            setFormData(prev => ({
                ...prev,
                cash_amount: formData.amount,
                bank_amount: '0'
            }));
        } else if (formData.cash_type === 'bank' && !formData.bank_amount && formData.amount) {
            setFormData(prev => ({
                ...prev,
                cash_amount: '0',
                bank_amount: formData.amount
            }));
        }
    }, [formData.cash_type]);

    // Fetch functions
    const fetchAccounts = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/accounts', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.data?.success) {
                setAccounts(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchLedgerHeads = async (accountId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get(`/api/ledger-heads?account_id=${accountId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
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
            const token = localStorage.getItem('token');
            const response = await api.get('/api/booklets', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.data?.success) {
                setBooklets(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching booklets:', error);
        }
    };

    const fetchDonors = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/donors', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.data?.success) {
                setDonors(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching donors:', error);
        }
    };

    const validateTransactionDate = async (date) => {
        try {
            // Add authorization header
            const token = localStorage.getItem('token');
            const response = await api.post('/api/transactions/validate-date', {
                transaction_date: date
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data?.success) {
                setDateValidation(response.data.data);
            }
        } catch (error) {
            console.error('Date validation error:', error);

            // Fallback to client-side validation if API fails
            const today = new Date().toISOString().split('T')[0];
            const selectedDate = new Date(date);
            const todayDate = new Date(today);
            const daysDifference = Math.ceil((todayDate - selectedDate) / (1000 * 60 * 60 * 24));

            if (daysDifference < 0) {
                setDateValidation({
                    allowed: false,
                    reason: 'Future dates are not allowed',
                    status: 'error'
                });
            } else if (daysDifference === 0) {
                setDateValidation({
                    allowed: true,
                    approvalLevel: 0,
                    reason: 'Current date - No approval needed',
                    status: 'allowed'
                });
            } else if (daysDifference <= 2) {
                setDateValidation({
                    allowed: true,
                    approvalLevel: 0,
                    reason: 'Weekend grace period',
                    status: 'grace_period'
                });
            } else {
                setDateValidation({
                    allowed: false,
                    reason: 'Please contact administrator for older dates',
                    status: 'error'
                });
            }
        }
    };

    // Handle form changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAmountChange = (mainAmount) => {
        const amount = parseFloat(mainAmount) || 0;
        setFormData(prev => {
            let updatedData = {
                ...prev,
                amount: mainAmount
            };

            // Auto-distribute amounts based on payment method
            if (prev.cash_type === 'cash') {
                updatedData.cash_amount = mainAmount;
                updatedData.bank_amount = '';
            } else if (prev.cash_type === 'bank') {
                updatedData.cash_amount = '';
                updatedData.bank_amount = mainAmount;
            }
            // For 'both', keep existing distribution or leave empty for user to fill

            return updatedData;
        });
    };

    // Handle payment method change with automatic amount distribution
    const handlePaymentMethodChange = (method) => {
        setFormData(prev => {
            const currentAmount = parseFloat(prev.amount) || 0;
            let updatedData = {
                ...prev,
                cash_type: method
            };

            // Auto-distribute amounts based on payment method
            if (method === 'cash') {
                updatedData.cash_amount = currentAmount > 0 ? currentAmount.toString() : prev.cash_amount || '';
                updatedData.bank_amount = '';
            } else if (method === 'bank') {
                updatedData.cash_amount = '';
                updatedData.bank_amount = currentAmount > 0 ? currentAmount.toString() : prev.bank_amount || '';
            }
            // For 'both', keep current values or reset to empty if switching from single method

            return updatedData;
        });
    };

    // Handle booklet selection
    const handleBookletChange = (bookletId) => {
        handleInputChange('booklet_id', bookletId);

        // Find and set the selected booklet for page selection
        const booklet = booklets.find(b => b.id.toString() === bookletId);
        setSelectedBooklet(booklet || null);

        // Reset page selection when booklet changes
        handleInputChange('receipt_page_no', '');
    };

    // Form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!dateValidation?.allowed) {
            toast.error('Please select a valid transaction date');
            return;
        }

        // Validate payment method and amounts
        if (!formData.cash_type) {
            toast.error('Please select a payment method');
            return;
        }

        // Validate amount distribution based on payment method
        if (formData.cash_type === 'both') {
            const cashAmount = parseFloat(formData.cash_amount || 0);
            const bankAmount = parseFloat(formData.bank_amount || 0);
            const mainAmount = parseFloat(formData.amount || 0);

            if (cashAmount + bankAmount !== mainAmount) {
                toast.error('Split amounts must equal the main transaction amount');
                return;
            }

            if (cashAmount <= 0 && bankAmount <= 0) {
                toast.error('At least one amount (cash or bank) must be greater than zero');
                return;
            }
        }

        setLoading(true);

        try {
            console.log('🔄 Submitting immutable credit transaction...');

            // Prepare final data with correct amount distribution
            const submitData = { ...formData };
            const mainAmount = parseFloat(formData.amount || 0);

            if (formData.cash_type === 'cash') {
                submitData.cash_amount = mainAmount;
                submitData.bank_amount = 0;
            } else if (formData.cash_type === 'bank') {
                submitData.cash_amount = 0;
                submitData.bank_amount = mainAmount;
            }
            // For 'both', use the entered values

            console.log('📊 Final submit data:', submitData);

            // Add authorization header
            const token = localStorage.getItem('token');
            const response = await api.post('/api/transactions/credit', submitData, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

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
        if (step < 5) setStep(step + 1);
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
                <div className="flex items-center justify-between">
                    {[1, 2, 3, 4, 5].map((stepNum) => (
                        <div key={stepNum} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                step >= stepNum
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-600'
                            }`}>
                                {stepNum}
                            </div>
                            <div className="ml-2 text-sm">
                                {stepNum === 1 && 'Date'}
                                {stepNum === 2 && 'Account'}
                                {stepNum === 3 && 'Ledger'}
                                {stepNum === 4 && 'Payment'}
                                {stepNum === 5 && 'Amount'}
                            </div>
                            {stepNum < 5 && (
                                <div className={`w-12 h-0.5 mx-4 ${
                                    step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
                {/* Step 1: Transaction Date */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <FaCalendarAlt className="text-4xl text-blue-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900">Transaction Date</h3>
                            <p className="text-gray-600 mt-2">Select the date for this transaction</p>
                        </div>

                        <div className="max-w-md mx-auto">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Transaction Date *
                            </label>
                            <input
                                type="date"
                                value={formData.transaction_date}
                                onChange={(e) => handleInputChange('transaction_date', e.target.value)}
                                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />

                            <DateStatusIndicator validation={dateValidation} />

                            {/* Date Information Panel */}
                            <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                                <div className="flex items-center">
                                    <FaInfoCircle className="text-blue-600 mr-3" />
                                    <div>
                                        <h4 className="font-medium text-blue-800">Date Policy</h4>
                                        <ul className="text-sm text-blue-700 mt-2 space-y-1">
                                            <li>• Current date: Always allowed</li>
                                            <li>• Weekend work: 2-day grace period</li>
                                            <li>• 3-5 days back: Manager approval</li>
                                            <li>• 6-10 days back: Director approval</li>
                                            <li>• Older than 10 days: Use correction workflow</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center mt-8">
                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={!dateValidation?.allowed}
                                className={`px-6 py-3 rounded-lg font-medium ${
                                    dateValidation?.allowed
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Continue to Account Selection
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Account Selection */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <FaUniversity className="text-4xl text-blue-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900">Select Account</h3>
                            <p className="text-gray-600 mt-2">Choose the account for this transaction</p>
                        </div>

                        <div className="max-w-md mx-auto">
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

                        <div className="flex justify-center space-x-4 mt-8">
                            <button
                                type="button"
                                onClick={prevStep}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={!formData.account_id}
                                className={`px-6 py-3 rounded-lg font-medium ${
                                    formData.account_id
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Continue to Ledger
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Ledger Head Selection */}
                {step === 3 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <FaEdit className="text-4xl text-green-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900">Select Ledger Head</h3>
                            <p className="text-gray-600 mt-2">Choose the income category</p>
                        </div>

                        <div className="max-w-md mx-auto">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Credit Ledger Head *
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

                        <div className="flex justify-center space-x-4 mt-8">
                            <button
                                type="button"
                                onClick={prevStep}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={!formData.ledger_head_id}
                                className={`px-6 py-3 rounded-lg font-medium ${
                                    formData.ledger_head_id
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Continue to Payment
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Payment Details */}
                {step === 4 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <FaBook className="text-4xl text-purple-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900">Payment Details</h3>
                            <p className="text-gray-600 mt-2">Enter payment method and references</p>
                        </div>

                        <div className="max-w-2xl mx-auto space-y-4">
                            {/* Payment Method Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Payment Method *
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                    {/* Cash Only */}
                                    <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                        formData.cash_type === 'cash'
                                            ? 'border-green-500 bg-green-50 shadow-md'
                                            : 'border-gray-200 hover:border-green-300 hover:bg-green-25'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="cash_type"
                                            value="cash"
                                            checked={formData.cash_type === 'cash'}
                                            onChange={(e) => handlePaymentMethodChange(e.target.value)}
                                            className="mr-4 text-green-600 focus:ring-green-500 w-4 h-4"
                                        />
                                        <FaMoneyBillWave className="mr-3 text-green-600 text-xl" />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">Cash Only</div>
                                            <div className="text-sm text-gray-600">Physical cash payment only</div>
                                        </div>
                                    </label>

                                    {/* Bank Only */}
                                    <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                        formData.cash_type === 'bank'
                                            ? 'border-blue-500 bg-blue-50 shadow-md'
                                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="cash_type"
                                            value="bank"
                                            checked={formData.cash_type === 'bank'}
                                            onChange={(e) => handlePaymentMethodChange(e.target.value)}
                                            className="mr-4 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                        />
                                        <FaUniversity className="mr-3 text-blue-600 text-xl" />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">Bank Only</div>
                                            <div className="text-sm text-gray-600">Bank transfer or cheque only</div>
                                        </div>
                                    </label>

                                    {/* Both Cash and Bank */}
                                    <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                        formData.cash_type === 'both'
                                            ? 'border-purple-500 bg-purple-50 shadow-md'
                                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="cash_type"
                                            value="both"
                                            checked={formData.cash_type === 'both'}
                                            onChange={(e) => handlePaymentMethodChange(e.target.value)}
                                            className="mr-4 text-purple-600 focus:ring-purple-500 w-4 h-4"
                                        />
                                        <FaCreditCard className="mr-3 text-purple-600 text-xl" />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">Both (Cash + Bank)</div>
                                            <div className="text-sm text-gray-600">Split payment between cash and bank</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Receipt Booklet Selection */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        📋 Receipt Booklet (Optional)
                                    </label>

                                    {/* Booklet Selection */}
                                    <div className="relative">
                                        <select
                                            value={formData.booklet_id}
                                            onChange={(e) => handleBookletChange(e.target.value)}
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        >
                                            <option value="">📋 Select Receipt Booklet...</option>
                                            {booklets.map(booklet => (
                                                <option key={booklet.id} value={booklet.id}>
                                                    📖 Booklet #{booklet.booklet_no} • Range: {booklet.start_no}-{booklet.end_no} • Available: {booklet.pages_left?.length || 0} pages
                                                </option>
                                            ))}
                                        </select>
                                        <FaBook className="absolute right-4 top-4 text-gray-400 pointer-events-none" />
                                    </div>

                                    {/* Show Selected Booklet Info */}
                                    {selectedBooklet && (
                                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center mb-2">
                                                <FaBook className="text-blue-600 mr-2" />
                                                <span className="font-medium text-blue-800">
                                                    Selected: Booklet #{selectedBooklet.booklet_no}
                                                </span>
                                            </div>
                                            <div className="text-sm text-blue-700 grid grid-cols-2 gap-2">
                                                <div>📄 Total Range: {selectedBooklet.start_no} - {selectedBooklet.end_no}</div>
                                                <div>✅ Available Pages: {selectedBooklet.pages_left?.length || 0}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Page Number Selection */}
                                {selectedBooklet && selectedBooklet.pages_left && selectedBooklet.pages_left.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            🔢 Select Receipt Page Number *
                                        </label>

                                        {/* Page Number Dropdown */}
                                        <div className="relative">
                                            <select
                                                value={formData.receipt_page_no}
                                                onChange={(e) => handleInputChange('receipt_page_no', e.target.value)}
                                                className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                                                required={!!selectedBooklet}
                                            >
                                                <option value="">🔢 Choose page number...</option>
                                                {selectedBooklet.pages_left.map(pageNum => (
                                                    <option key={pageNum} value={pageNum}>
                                                        📄 Page {pageNum}
                                                    </option>
                                                ))}
                                            </select>
                                            <FaEdit className="absolute right-4 top-4 text-orange-400 pointer-events-none" />
                                        </div>

                                        {/* Page Selection Info */}
                                        {formData.receipt_page_no && (
                                            <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                                <div className="flex items-center text-orange-800">
                                                    <FaCheckCircle className="text-orange-600 mr-2" />
                                                    <span className="font-medium">
                                                        Receipt will be printed on Page #{formData.receipt_page_no}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Available Pages Preview (Compact) */}
                                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                            <div className="text-xs text-gray-600 mb-2">Available page numbers:</div>
                                            <div className="flex flex-wrap gap-1">
                                                {selectedBooklet.pages_left.slice(0, 20).map(pageNum => (
                                                    <span
                                                        key={pageNum}
                                                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                                            formData.receipt_page_no === pageNum.toString()
                                                                ? 'bg-orange-500 text-white'
                                                                : 'bg-gray-200 text-gray-700'
                                                        }`}
                                                    >
                                                        {pageNum}
                                                    </span>
                                                ))}
                                                {selectedBooklet.pages_left.length > 20 && (
                                                    <span className="text-xs text-gray-500">
                                                        ...and {selectedBooklet.pages_left.length - 20} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* No Pages Available Warning */}
                                {selectedBooklet && (!selectedBooklet.pages_left || selectedBooklet.pages_left.length === 0) && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="flex items-center text-red-800">
                                            <FaExclamationTriangle className="text-red-600 mr-2" />
                                            <span className="font-medium">
                                                No pages available in this booklet
                                            </span>
                                        </div>
                                        <div className="text-sm text-red-600 mt-1">
                                            This booklet has been fully used. Please select a different booklet.
                                        </div>
                                    </div>
                                )}
                            </div>

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

                        <div className="flex justify-center space-x-4 mt-8">
                            <button
                                type="button"
                                onClick={prevStep}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={nextStep}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Continue to Amount
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 5: Amount and Description */}
                {step === 5 && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <FaMoneyBillWave className="text-4xl text-green-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900">Amount & Description</h3>
                            <p className="text-gray-600 mt-2">Enter transaction amount and description</p>
                        </div>

                        <div className="max-w-md mx-auto space-y-6">
                            {/* Main Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Transaction Amount *
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
                                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Dynamic Payment Method Display */}
                            <div className={`p-4 rounded-lg mb-4 ${
                                formData.cash_type === 'cash' ? 'bg-green-50 border border-green-200' :
                                formData.cash_type === 'bank' ? 'bg-blue-50 border border-blue-200' :
                                formData.cash_type === 'both' ? 'bg-purple-50 border border-purple-200' :
                                'bg-gray-50 border border-gray-200'
                            }`}>
                                <div className={`text-sm font-medium mb-3 flex items-center ${
                                    formData.cash_type === 'cash' ? 'text-green-800' :
                                    formData.cash_type === 'bank' ? 'text-blue-800' :
                                    formData.cash_type === 'both' ? 'text-purple-800' :
                                    'text-gray-800'
                                }`}>
                                    {formData.cash_type === 'cash' && <><FaMoneyBillWave className="mr-2" /> Cash Payment Only</>}
                                    {formData.cash_type === 'bank' && <><FaUniversity className="mr-2" /> Bank Payment Only</>}
                                    {formData.cash_type === 'both' && <><FaCreditCard className="mr-2" /> Split Payment (Cash + Bank)</>}
                                    {!formData.cash_type && <>💡 Please select payment method first</>}
                                </div>

                                {/* Cash Only Mode */}
                                {formData.cash_type === 'cash' && (
                                    <div className="text-sm text-green-700">
                                        ✅ Transaction amount will be processed as cash payment
                                        <div className="mt-2 p-2 bg-green-100 rounded text-xs">
                                            Cash Amount: ₹{formData.amount || '0.00'}
                                        </div>
                                    </div>
                                )}

                                {/* Bank Only Mode */}
                                {formData.cash_type === 'bank' && (
                                    <div className="text-sm text-blue-700">
                                        ✅ Transaction amount will be processed as bank transfer/cheque
                                        <div className="mt-2 p-2 bg-blue-100 rounded text-xs">
                                            Bank Amount: ₹{formData.amount || '0.00'}
                                        </div>
                                    </div>
                                )}

                                {/* Both Mode - Show Split Fields */}
                                {formData.cash_type === 'both' && (
                                    <div>
                                        <div className="text-sm text-purple-700 mb-3">
                                            💰 Split the total amount between cash and bank payment:
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Cash Amount
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-500">₹</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={formData.cash_amount}
                                                        onChange={(e) => handleInputChange('cash_amount', e.target.value)}
                                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Bank Amount
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-500">₹</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={formData.bank_amount}
                                                        onChange={(e) => handleInputChange('bank_amount', e.target.value)}
                                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Split Validation */}
                                        <div className="mt-3 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-600">
                                                    <strong>Split Total:</strong> ₹{(parseFloat(formData.cash_amount || 0) + parseFloat(formData.bank_amount || 0)).toFixed(2)}
                                                </span>
                                                <span className="text-gray-600">
                                                    <strong>Main Amount:</strong> ₹{parseFloat(formData.amount || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            {parseFloat(formData.amount || 0) !== (parseFloat(formData.cash_amount || 0) + parseFloat(formData.bank_amount || 0)) && (
                                                <div className="text-orange-600 text-xs mt-1 flex items-center">
                                                    <FaExclamationTriangle className="mr-1" />
                                                    Split amounts must equal the main amount
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

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
                                disabled={loading || !formData.amount || !formData.description}
                                className={`px-8 py-3 rounded-lg font-medium flex items-center ${
                                    loading || !formData.amount || !formData.description
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