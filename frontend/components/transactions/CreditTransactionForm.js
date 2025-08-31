import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaSave,
    FaTimes,
    FaCalendarAlt,
    FaRupeeSign,
    FaMoneyBillWave,
    FaUniversity,
    FaInfoCircle,
    FaSpinner
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

export default function CreditTransactionForm({ onSuccess, onCancel, transaction = null, isEditing = false }) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form state with step-by-step progression
    const [currentStep, setCurrentStep] = useState(1); // 1: Date, 2: Account, 3: Ledger, 4: Payment, 5: Amount
    const [isDateSelected, setIsDateSelected] = useState(false);
    const [openPeriods, setOpenPeriods] = useState([]);
    const [dateRestrictions, setDateRestrictions] = useState({ min: null, max: null });

    // Form data
    const [formData, setFormData] = useState({
        tx_date: '',
        account_id: '',
        ledger_head_id: '',
        donor_id: '',
        booklet_id: '',
        receipt_no: '',
        amount: '',
        cash_amount: '',
        bank_amount: '',
        cash_type: 'cash',
        description: ''
    });

    // Options
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [donors, setDonors] = useState([]);
    const [booklets, setBooklets] = useState([]);
    
    // Balance display
    const [ledgerBalance, setLedgerBalance] = useState(null);

    // Form validation errors
    const [errors, setErrors] = useState({});

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: 8000,
        headers: { 'Content-Type': 'application/json' }
    });

    // Initialize form
    useEffect(() => {
        initializeForm();
    }, []);

    const initializeForm = async () => {
        try {
            setLoading(true);
            await Promise.all([
                fetchOpenPeriods(),
                fetchAccounts(),
                fetchDonors()
            ]);
            
            // If editing, populate form
            if (isEditing && transaction) {
                setFormData({
                    tx_date: transaction.tx_date,
                    account_id: transaction.account_id,
                    ledger_head_id: transaction.ledger_head_id,
                    donor_id: transaction.donor_id || '',
                    booklet_id: transaction.booklet_id || '',
                    receipt_no: transaction.receipt_no || '',
                    amount: transaction.amount,
                    cash_amount: transaction.cash_amount || '0',
                    bank_amount: transaction.bank_amount || '0',
                    cash_type: transaction.cash_type,
                    description: transaction.description || ''
                });
                setIsDateSelected(true);
                setCurrentStep(5);
            }
        } catch (error) {
            console.error('Error initializing form:', error);
            toast.error('Failed to load form data');
        } finally {
            setLoading(false);
        }
    };

    const fetchOpenPeriods = async () => {
        try {
            const response = await api.get(`${API_CONFIG.API_PREFIX}/periods/all-open`);
            if (response.data.success) {
                setOpenPeriods(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching open periods:', error);
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

    const fetchDonors = async () => {
        try {
            const response = await api.get(`${API_CONFIG.API_PREFIX}/donors`);
            if (response.data.success) {
                setDonors(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching donors:', error);
        }
    };

    const fetchLedgerHeads = async (accountId, date) => {
        if (!accountId || !date) return;

        try {
            const response = await api.get(`${API_CONFIG.API_PREFIX}/ledger-heads`, {
                params: { account_id: accountId, head_type: 'credit', for_date: date }
            });
            if (response.data.success) {
                setLedgerHeads(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching ledger heads:', error);
            toast.error('Failed to load ledger heads');
        }
    };

    const fetchBooklets = async (accountId) => {
        if (!accountId) return;

        try {
            const response = await api.get(`${API_CONFIG.API_PREFIX}/booklets`, {
                params: { account_id: accountId, status: 'active' }
            });
            if (response.data.success) {
                setBooklets(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching booklets:', error);
        }
    };

    const fetchLedgerBalance = async (ledgerHeadId, date) => {
        if (!ledgerHeadId || !date) return;

        try {
            const response = await api.get(`${API_CONFIG.API_PREFIX}/transactions/snapshot`, {
                params: { ledger_head_id: ledgerHeadId, date: date }
            });
            
            if (response.data.success && response.data.data) {
                setLedgerBalance(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching balance:', error);
        }
    };

    // Check if date is within open period - using date-only comparison
    const isDateInOpenPeriod = (date) => {
        if (!date || !openPeriods.length) return false;
        
        const selectedDate = new Date(date);
        const selectedYear = selectedDate.getFullYear();
        const selectedMonth = selectedDate.getMonth() + 1; // Convert to 1-12
        const selectedDay = selectedDate.getDate();
        
        return openPeriods.some(period => {
            // Check if date falls within this period's month/year
            if (selectedYear !== period.year || selectedMonth !== period.month) {
                return false;
            }
            
            // Check if the day is valid for this month (should always be true for valid dates)
            const daysInMonth = new Date(period.year, period.month, 0).getDate();
            return selectedDay >= 1 && selectedDay <= daysInMonth;
        });
    };

    // Handle form field changes
    const handleDateChange = async (e) => {
        const newDate = e.target.value;
        
        // For now, allow the date to be set - we'll validate it properly when an account is selected
        // This allows the user to proceed to account selection first
        setFormData(prev => ({ ...prev, tx_date: newDate }));
        setIsDateSelected(true);
        setCurrentStep(2);
        setErrors(prev => ({ ...prev, tx_date: null }));

        // Reset dependent fields
        setFormData(prev => ({ ...prev, account_id: '', ledger_head_id: '', amount: '' }));
        setLedgerHeads([]);
        setLedgerBalance(null);
    };

    const handleAccountChange = async (accountId) => {
        setFormData(prev => ({ ...prev, account_id: accountId, ledger_head_id: '' }));
        setLedgerBalance(null);
        
        // Get date restrictions for this account
        await getDateRestrictionsForAccount(accountId);
        
        // Validate the selected date against this specific account's open period
        await validateDateForAccount(accountId, formData.tx_date);
        
        await fetchLedgerHeads(accountId, formData.tx_date);
        await fetchBooklets(accountId);
    };

    // Get date restrictions for the selected account
    const getDateRestrictionsForAccount = async (accountId) => {
        if (!accountId) {
            setDateRestrictions({ min: null, max: null });
            return;
        }

        try {
            // Get period statuses for current year
            const currentYear = new Date().getFullYear();
            const response = await api.get(`${API_CONFIG.API_PREFIX}/periods/year-status`, {
                params: { 
                    account_id: accountId,
                    year: currentYear
                }
            });
            
            if (response.data.success && response.data.data && response.data.data.periods) {
                const periods = response.data.data.periods;
                
                // Find all open periods (months where periods[month] === true)
                const openMonths = Object.keys(periods)
                    .filter(month => periods[month] === true)
                    .map(month => parseInt(month))
                    .sort((a, b) => a - b); // Sort numerically
                
                if (openMonths.length > 0) {
                    // Calculate date range from earliest to latest open period
                    const earliestMonth = openMonths[0];
                    const latestMonth = openMonths[openMonths.length - 1];
                    
                    // Create date strings directly to avoid timezone issues
                    const minDate = `${currentYear}-${String(earliestMonth).padStart(2, '0')}-01`;
                    
                    // Get the last day of the latest open month
                    const lastDayOfMonth = new Date(currentYear, latestMonth, 0).getDate();
                    const maxDate = `${currentYear}-${String(latestMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
                    
                    setDateRestrictions({ min: minDate, max: maxDate });
                    
                    const monthNames = [
                        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                    ];
                    
                    const openPeriodNames = openMonths.map(m => monthNames[m - 1]).join(', ');
                    console.log(`Date restrictions set for account ${accountId}: ${minDate} to ${maxDate} (Open periods: ${openPeriodNames})`);
                } else {
                    // No open periods found
                    setDateRestrictions({ min: null, max: null });
                    console.log(`No open periods found for account ${accountId} in ${currentYear}`);
                }
            } else {
                // No period data available
                setDateRestrictions({ min: null, max: null });
                console.log(`No period data available for account ${accountId} in ${currentYear}`);
            }
        } catch (error) {
            console.error('Error getting date restrictions:', error);
            setDateRestrictions({ min: null, max: null });
        }
    };

    // Validate if the selected date is valid for the specific account
    const validateDateForAccount = async (accountId, date) => {
        if (!accountId || !date) return;
        
        try {
            const response = await api.get(`${API_CONFIG.API_PREFIX}/periods/validate-date`, {
                params: { account_id: accountId, date: date }
            });
            
            if (response.data.success) {
                if (response.data.data.isValid) {
                    // Date is valid for this account
                    setErrors(prev => ({ ...prev, tx_date: null }));
                    setCurrentStep(3);
                } else {
                    // Date is not valid for this account
                    const message = response.data.data.openPeriod 
                        ? `Selected date is not within the open period for this account. Currently open: ${response.data.data.openPeriod.displayName}`
                        : 'No open accounting period exists for this account. Please open a period first.';
                    
                    setErrors(prev => ({ ...prev, tx_date: message }));
                    setCurrentStep(2); // Stay at account selection step
                }
            }
        } catch (error) {
            console.error('Error validating date for account:', error);
            setErrors(prev => ({ ...prev, tx_date: 'Failed to validate date for this account. Please try again.' }));
            setCurrentStep(2);
        }
    };

    const handleLedgerHeadChange = async (ledgerHeadId) => {
        setFormData(prev => ({ ...prev, ledger_head_id: ledgerHeadId }));
        setCurrentStep(4);
        
        await fetchLedgerBalance(ledgerHeadId, formData.tx_date);
    };

    const handlePaymentMethodChange = (method) => {
        setFormData(prev => ({ ...prev, cash_type: method }));
        setCurrentStep(5);
        
        // Reset amounts when payment method changes
        if (method === 'cash') {
            setFormData(prev => ({ ...prev, bank_amount: '0', cash_amount: prev.amount }));
        } else if (method === 'bank') {
            setFormData(prev => ({ ...prev, cash_amount: '0', bank_amount: prev.amount }));
        }
    };

    const handleAmountChange = (amount) => {
        setFormData(prev => ({ 
            ...prev, 
            amount: amount,
            cash_amount: prev.cash_type === 'cash' || prev.cash_type === 'both' ? amount : '0',
            bank_amount: prev.cash_type === 'bank' || prev.cash_type === 'both' ? amount : '0'
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        const newErrors = {};
        if (!formData.tx_date) newErrors.tx_date = 'Transaction date is required';
        if (!formData.account_id) newErrors.account_id = 'Account is required';
        if (!formData.ledger_head_id) newErrors.ledger_head_id = 'Ledger head is required';
        if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Valid amount is required';
        if (!formData.booklet_id && !isEditing) newErrors.booklet_id = 'Booklet is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setSubmitting(true);
            
            const endpoint = isEditing 
                ? `${API_CONFIG.API_PREFIX}/transactions/${transaction.id}`
                : `${API_CONFIG.API_PREFIX}/transactions/credit`;
            
            const method = isEditing ? 'patch' : 'post';
            const response = await api[method](endpoint, formData);

            if (response.data.success) {
                toast.success(isEditing ? 'Transaction updated successfully' : 'Credit transaction created successfully');
                if (onSuccess) onSuccess(response.data.data);
            }
        } catch (error) {
            console.error('Error submitting transaction:', error);
            toast.error(error.response?.data?.message || 'Failed to save transaction');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <FaSpinner className="animate-spin text-3xl text-blue-500" />
                <span className="ml-3 text-lg">Loading form...</span>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Balance Summary Card */}
            {ledgerBalance && (
                <div className="balance-card">
                    <div className="flex items-center mb-4">
                        <FaInfoCircle className="text-blue-500 text-lg mr-2" />
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Current Balance</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="balance-item">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                ₹{parseFloat(ledgerBalance.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Balance</div>
                        </div>
                        <div className="balance-item">
                            <div className="text-2xl font-bold text-blue-600">
                                ₹{parseFloat(ledgerBalance.bank_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Cash in Bank</div>
                        </div>
                        <div className="balance-item">
                            <div className="text-2xl font-bold text-green-600">
                                ₹{parseFloat(ledgerBalance.cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Cash in Hand</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    
                    {/* Step 1: Transaction Date */}
                    <div className="form-section space-y-4">
                        <div className="flex items-center relative">
                            <div className={`step-indicator ${currentStep >= 1 ? 'active' : 'inactive'} mr-3`}>1</div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transaction Date *</h3>
                        </div>
                        
                        <div className="ml-11">
                            <div className="relative max-w-sm">
                                <FaCalendarAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="date"
                                    value={formData.tx_date}
                                    onChange={handleDateChange}
                                    min={dateRestrictions.min || undefined}
                                    max={dateRestrictions.max || undefined}
                                    className="form-input pl-10 max-w-sm"
                                    required
                                />
                            </div>
                            {errors.tx_date && (
                                <p className="error-message">{errors.tx_date}</p>
                            )}
                            <p className="mt-2 text-sm text-gray-500">
                                {formData.account_id ? (
                                    dateRestrictions.min && dateRestrictions.max ? (
                                        <>Only dates from <strong>{dateRestrictions.min}</strong> to <strong>{dateRestrictions.max}</strong> are allowed for this account</>
                                    ) : (
                                        <>No open period exists for this account. Please select a different account or open a period first.</>
                                    )
                                ) : (
                                    <>Select an account to see available date range</>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Step 2: Account Selection */}
                    <div className={`step-section form-section space-y-4 ${!isDateSelected ? 'disabled' : ''}`}>
                        <div className="flex items-center relative">
                            <div className={`step-indicator ${currentStep >= 2 ? 'active' : 'inactive'} mr-3`}>2</div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Account *</h3>
                            {currentStep > 2 && <div className="step-connector completed"></div>}
                        </div>
                        
                        <div className="ml-11">
                            <select
                                value={formData.account_id}
                                onChange={(e) => handleAccountChange(e.target.value)}
                                className="form-input max-w-sm"
                                disabled={!isDateSelected}
                                required
                            >
                                <option value="">Select an account</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                            {errors.account_id && (
                                <p className="error-message">{errors.account_id}</p>
                            )}
                            {formData.account_id && (
                                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        {dateRestrictions.min && dateRestrictions.max ? (
                                            <>✅ <strong>Open Period:</strong> {dateRestrictions.min} to {dateRestrictions.max}</>
                                        ) : (
                                            <>❌ <strong>No Open Period:</strong> Please open a period for this account first</>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Ledger Head Selection */}
                    <div className={`space-y-4 ${currentStep < 3 ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-3 ${
                                currentStep >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>3</div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Income Source (Ledger Head) *</h3>
                        </div>
                        
                        <div className="ml-11">
                            <select
                                value={formData.ledger_head_id}
                                onChange={(e) => handleLedgerHeadChange(e.target.value)}
                                className="w-full max-w-sm px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                                disabled={currentStep < 3}
                                required
                            >
                                <option value="">Select ledger head</option>
                                {ledgerHeads.map(head => (
                                    <option key={head.id} value={head.id}>
                                        {head.name}
                                    </option>
                                ))}
                            </select>
                            {errors.ledger_head_id && (
                                <p className="mt-2 text-sm text-red-600">{errors.ledger_head_id}</p>
                            )}
                        </div>
                    </div>

                    {/* Step 4: Payment Method */}
                    <div className={`space-y-4 ${currentStep < 4 ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-3 ${
                                currentStep >= 4 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>4</div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Payment Method *</h3>
                        </div>
                        
                        <div className="ml-11">
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => handlePaymentMethodChange('cash')}
                                    className={`payment-method-btn ${
                                        formData.cash_type === 'cash'
                                            ? 'selected border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                                    }`}
                                    disabled={currentStep < 4}
                                >
                                    <FaMoneyBillWave />
                                    Cash
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => handlePaymentMethodChange('bank')}
                                    className={`payment-method-btn ${
                                        formData.cash_type === 'bank'
                                            ? 'selected border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                                    }`}
                                    disabled={currentStep < 4}
                                >
                                    <FaUniversity />
                                    Bank
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => handlePaymentMethodChange('both')}
                                    className={`payment-method-btn ${
                                        formData.cash_type === 'both'
                                            ? 'selected border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                                    }`}
                                    disabled={currentStep < 4}
                                >
                                    <FaMoneyBillWave />
                                    <FaUniversity />
                                    Both
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 5: Amount & Additional Details */}
                    <div className={`space-y-6 ${currentStep < 5 ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-3 ${
                                currentStep >= 5 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>5</div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Amount & Details</h3>
                        </div>
                        
                        <div className="ml-11 space-y-6">
                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Amount *
                                </label>
                                <div className="relative max-w-sm">
                                    <FaRupeeSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.amount}
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        className="form-input pl-10"
                                        placeholder="0.00"
                                        disabled={currentStep < 5}
                                        required
                                    />
                                </div>
                                {errors.amount && (
                                    <p className="error-message">{errors.amount}</p>
                                )}
                            </div>

                            {/* Donor (Optional) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Donor (Optional)
                                </label>
                                <select
                                    value={formData.donor_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, donor_id: e.target.value }))}
                                    className="form-input max-w-sm"
                                    disabled={currentStep < 5}
                                >
                                    <option value="">Select donor (optional)</option>
                                    {donors.map(donor => (
                                        <option key={donor.id} value={donor.id}>
                                            {donor.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Booklet & Receipt */}
                            {!isEditing && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Booklet *
                                        </label>
                                        <select
                                            value={formData.booklet_id}
                                            onChange={(e) => setFormData(prev => ({ ...prev, booklet_id: e.target.value }))}
                                            className="form-input"
                                            disabled={currentStep < 5}
                                            required
                                        >
                                            <option value="">Select booklet</option>
                                            {booklets.map(booklet => (
                                                <option key={booklet.id} value={booklet.id}>
                                                    {booklet.name} ({booklet.pages_left?.length || 0} pages left)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Receipt No.
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.receipt_no}
                                            onChange={(e) => setFormData(prev => ({ ...prev, receipt_no: e.target.value }))}
                                            className="form-input"
                                            placeholder="Auto-assign if empty"
                                            disabled={currentStep < 5}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows="3"
                                    className="form-input resize-none"
                                    placeholder="Any additional notes..."
                                    disabled={currentStep < 5}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            disabled={submitting}
                        >
                            <FaTimes className="mr-2" />
                            Cancel
                        </button>
                        
                        <button
                            type="submit"
                            disabled={submitting || currentStep < 5}
                            className="submit-btn bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white"
                        >
                            {submitting ? (
                                <FaSpinner className="loading-spinner mr-2" />
                            ) : (
                                <FaSave className="mr-2" />
                            )}
                            {submitting ? 'Saving...' : isEditing ? 'Update Transaction' : 'Create Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}