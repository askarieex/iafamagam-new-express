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
    FaInfoCircle
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
        // is_cheque field removed - now part of cash_type
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

    // Search and dropdown state
    const [accountSearchQuery, setAccountSearchQuery] = useState('');
    const [sourceLedgerSearchQuery, setSourceLedgerSearchQuery] = useState('');
    const [debitLedgerSearchQuery, setDebitLedgerSearchQuery] = useState('');
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const [isSourceLedgerDropdownOpen, setIsSourceLedgerDropdownOpen] = useState(false);
    const [isDebitLedgerDropdownOpen, setIsDebitLedgerDropdownOpen] = useState(false);

    // Refs for dropdown click outside handling
    const accountDropdownRef = useRef(null);
    const sourceLedgerDropdownRef = useRef(null);
    const debitLedgerDropdownRef = useRef(null);

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: 8000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
                setIsAccountDropdownOpen(false);
            }
            if (sourceLedgerDropdownRef.current && !sourceLedgerDropdownRef.current.contains(event.target)) {
                setIsSourceLedgerDropdownOpen(false);
            }
            if (debitLedgerDropdownRef.current && !debitLedgerDropdownRef.current.contains(event.target)) {
                setIsDebitLedgerDropdownOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch accounts and ledger heads
    useEffect(() => {
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

                    // Find source ledger head (the one with negative side in transaction items)
                    let sourceLedgerHeadId = '';
                    if (transaction.items && transaction.items.length > 0) {
                        const sourceItem = transaction.items.find(item => item.side === '-');
                        if (sourceItem) {
                            sourceLedgerHeadId = sourceItem.ledger_head_id.toString();
                        }
                    }

                    setFormData({
                        account_id: transaction.account_id?.toString() || '',
                        source_ledger_head_id: sourceLedgerHeadId,
                        ledger_head_id: transaction.ledger_head_id?.toString() || '',
                        amount: transaction.amount?.toString() || '',
                        cash_amount: transaction.cash_amount?.toString() || '',
                        bank_amount: transaction.bank_amount?.toString() || '',
                        cash_type: transaction.cash_type === 'multiple' ? 'multiple' : transaction.cash_type || 'cash',
                        tx_date: transaction.tx_date || new Date().toISOString().split('T')[0],
                        description: transaction.description || '',
                        voucher_number: transaction.voucher_number || '',
                        manual_voucher: transaction.manual_voucher || false,
                        cheque_number: transaction.cheque_number || '',
                        bank_name: transaction.bank_name || '',
                        issue_date: transaction.issue_date || '',
                        due_date: transaction.due_date || ''
                    });
                } else if (accountsRes.data.data.length > 0) {
                    // Default account selection for new transactions
                    const defaultAccount = accountsRes.data.data[0].id;

                    // Find first credit and debit ledger heads for this account
                    const creditLedgerHead = ledgerHeadsRes.data.data.find(
                        head => head.account_id.toString() === defaultAccount.toString() && head.head_type === 'credit'
                    );

                    const debitLedgerHead = ledgerHeadsRes.data.data.find(
                        head => head.account_id.toString() === defaultAccount.toString() && head.head_type === 'debit'
                    );

                    setFormData(prev => ({
                        ...prev,
                        account_id: defaultAccount,
                        source_ledger_head_id: creditLedgerHead ? creditLedgerHead.id : '',
                        ledger_head_id: debitLedgerHead ? debitLedgerHead.id : ''
                    }));
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching form data:', err);
                setError('Failed to load form data. Please try again.');
                setLoading(false);
            }
        };

        fetchFormData();
    }, []);

    // Filter ledger heads based on type and account
    const creditLedgerHeads = ledgerHeads.filter(
        head => head.account_id.toString() === formData.account_id.toString() &&
            head.head_type === 'credit' &&
            head.name.toLowerCase().includes(sourceLedgerSearchQuery.toLowerCase())
    );

    const debitLedgerHeads = ledgerHeads.filter(
        head => head.account_id.toString() === formData.account_id.toString() &&
            head.head_type === 'debit' &&
            head.name.toLowerCase().includes(debitLedgerSearchQuery.toLowerCase())
    );

    // Calculate total amount from bank and cash amounts
    const calculateTotalAmount = () => {
        const bankAmount = parseFloat(formData.bank_amount) || 0;
        const cashAmount = parseFloat(formData.cash_amount) || 0;
        return bankAmount + cashAmount;
    };

    // Update amount when bank_amount or cash_amount changes
    useEffect(() => {
        if (formData.cash_type === 'multiple') {
            const totalAmount = calculateTotalAmount();
            setFormData(prev => ({
                ...prev,
                amount: totalAmount > 0 ? totalAmount : ''
            }));
        }
    }, [formData.bank_amount, formData.cash_amount, formData.cash_type]);

    // Handle account selection
    const handleAccountSelect = (account) => {
        // Find first credit and debit ledger heads for this account
        const creditLedgerHead = ledgerHeads.find(
            head => head.account_id.toString() === account.id.toString() && head.head_type === 'credit'
        );

        const debitLedgerHead = ledgerHeads.find(
            head => head.account_id.toString() === account.id.toString() && head.head_type === 'debit'
        );

        setFormData(prev => ({
            ...prev,
            account_id: account.id.toString(),
            source_ledger_head_id: creditLedgerHead ? creditLedgerHead.id.toString() : '',
            ledger_head_id: debitLedgerHead ? debitLedgerHead.id.toString() : ''
        }));

        setIsAccountDropdownOpen(false);
        setAccountSearchQuery('');
    };

    // Handle ledger head selections
    const handleSourceLedgerSelect = (ledger) => {
        // Update form data with the selected ledger
        setFormData(prev => ({
            ...prev,
            source_ledger_head_id: ledger.id.toString()
        }));

        // Clear source ledger head error
        setErrors(prev => ({
            ...prev,
            source_ledger_head_id: null
        }));

        // Check if we need to update payment method based on available balances
        const cashBalance = parseFloat(ledger.cash_balance || 0);
        const bankBalance = parseFloat(ledger.bank_balance || 0);

        // If current payment method is not valid for this ledger, switch to a valid one
        if (formData.cash_type === 'cash' && cashBalance <= 0) {
            if (bankBalance > 0) {
                setFormData(prev => ({ ...prev, cash_type: 'bank' }));
            }
        } else if (formData.cash_type === 'bank' && bankBalance <= 0) {
            if (cashBalance > 0) {
                setFormData(prev => ({ ...prev, cash_type: 'cash' }));
            }
        } else if (formData.cash_type === 'multiple' && (cashBalance <= 0 && bankBalance <= 0)) {
            // Both are zero - no valid option, leave as is but will be disabled
        } else if (formData.cash_type === 'multiple' && (cashBalance <= 0 || bankBalance <= 0)) {
            // One is zero, switch to the other
            if (cashBalance <= 0 && bankBalance > 0) {
                setFormData(prev => ({ ...prev, cash_type: 'bank' }));
            } else if (bankBalance <= 0 && cashBalance > 0) {
                setFormData(prev => ({ ...prev, cash_type: 'cash' }));
            }
        }

        // Validate current amount with new ledger head (if amount is already entered)
        if (formData.amount && formData.cash_type !== 'multiple') {
            const error = validateAmount(formData.cash_type, formData.amount, ledger);
            setErrors(prev => ({
                ...prev,
                amount: error
            }));
        } else if (formData.cash_type === 'multiple') {
            if (formData.cash_amount) {
                const cashError = validateAmount('cash', formData.cash_amount, ledger);
                setErrors(prev => ({
                    ...prev,
                    cash_amount: cashError
                }));
            }
            if (formData.bank_amount) {
                const bankError = validateAmount('bank', formData.bank_amount, ledger);
                setErrors(prev => ({
                    ...prev,
                    bank_amount: bankError
                }));
            }
        }

        setIsSourceLedgerDropdownOpen(false);
        setSourceLedgerSearchQuery('');
    };

    const handleDebitLedgerSelect = (ledger) => {
        setFormData(prev => ({
            ...prev,
            ledger_head_id: ledger.id.toString()
        }));
        setIsDebitLedgerDropdownOpen(false);
        setDebitLedgerSearchQuery('');
    };

    // Add sourceLedger variable before the return statement
    const sourceLedger = formData.source_ledger_head_id
        ? ledgerHeads.find(head => head.id.toString() === formData.source_ledger_head_id)
        : null;

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (type === 'checkbox') {
            setFormData(prev => ({
                ...prev,
                [name]: checked
            }));
        } else if (name === 'cash_type') {
            // Handle payment method change
            if (value === 'cheque') {
                // When switching to cheque, set up cheque-specific values
                const today = new Date().toISOString().split('T')[0];
                // Set default due date as 5 days from today
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 5);
                const dueDateStr = dueDate.toISOString().split('T')[0];

                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    issue_date: prev.issue_date || today,
                    due_date: prev.due_date || dueDateStr,
                    // Keep the amount if it exists
                    amount: prev.amount || '',
                    // Clear these as they're not used with cheque
                    cash_amount: '',
                    bank_amount: '',
                    // Set focus to cheque fields by ensuring they're not null
                    cheque_number: prev.cheque_number || '',
                    bank_name: prev.bank_name || ''
                }));

                // Clear any validation errors for cheque fields
                setErrors(prev => ({
                    ...prev,
                    cheque_number: null,
                    bank_name: null,
                    issue_date: null,
                    due_date: null
                }));
            } else if (value === 'multiple') {
                // If switching to multiple (Both), initialize cash and bank amounts
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    cash_amount: prev.amount || '',
                    bank_amount: '',
                    // Clear cheque fields if switching from cheque
                    ...(prev.cash_type === 'cheque' ? {
                        cheque_number: '',
                        bank_name: '',
                        issue_date: '',
                        due_date: ''
                    } : {})
                }));
                // Clear any existing amount errors
                setErrors(prev => ({
                    ...prev,
                    amount: null,
                    cash_amount: null,
                    bank_amount: null
                }));
            } else {
                // If switching to cash or bank, use the total amount
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    amount: prev.amount || calculateTotalAmount() || '',
                    // Clear cheque fields if switching from cheque
                    ...(prev.cash_type === 'cheque' ? {
                        cheque_number: '',
                        bank_name: '',
                        issue_date: '',
                        due_date: ''
                    } : {})
                }));

                // Only validate if the user has already entered an amount
                if (formData.amount) {
                    const error = validateAmount(value, formData.amount);
                    setErrors(prev => ({
                        ...prev,
                        amount: error,
                        cash_amount: null,
                        bank_amount: null
                    }));
                }
            }
        } else if (['amount', 'cash_amount', 'bank_amount'].includes(name)) {
            // For amount fields, update but only validate on blur or if field already has an error
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));

            // Only validate if the field has been touched before or user is actively editing a field with errors
            if (errors[name]) {
                let validationType = name === 'amount' ? formData.cash_type : (name === 'cash_amount' ? 'cash' : 'bank');
                const error = value ? validateAmount(validationType, value) : 'Amount is required';
                setErrors(prev => ({
                    ...prev,
                    [name]: error
                }));
            }
        } else if (formData.cash_type === 'cheque' && ['cheque_number', 'bank_name'].includes(name)) {
            // Special handling for cheque fields - validate immediately
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));

            // Immediate validation for cheque fields
            if (!value.trim()) {
                setErrors(prev => ({
                    ...prev,
                    [name]: name === 'cheque_number' ? 'Cheque number is required' : 'Bank name is required'
                }));
            } else {
                setErrors(prev => ({
                    ...prev,
                    [name]: null
                }));
            }
        } else {
            // Standard update for other fields
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));

            // Clear validation error for this field
            if (errors[name]) {
                setErrors(prev => ({
                    ...prev,
                    [name]: null
                }));
            }
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        // Required fields
        if (!formData.account_id) newErrors.account_id = 'Account is required';
        if (!formData.source_ledger_head_id) newErrors.source_ledger_head_id = 'Credit ledger head is required';
        if (!formData.ledger_head_id) newErrors.ledger_head_id = 'Debit ledger head is required';
        if (!formData.tx_date) newErrors.tx_date = 'Date is required';
        if (!formData.voucher_number) newErrors.voucher_number = 'Voucher number is required';

        // Validate voucher format if manual
        if (formData.manual_voucher && formData.voucher_number) {
            const voucherRegex = /^CV-\d+\/\d{2}\/\d{2}$/;
            if (!voucherRegex.test(formData.voucher_number)) {
                newErrors.voucher_number = 'Format must be CV-serial/MM/YY';
            }
        }

        // Amount validation
        if (formData.cash_type === 'multiple') {
            if (!formData.cash_amount && !formData.bank_amount) {
                newErrors.cash_amount = 'At least one amount is required';
                newErrors.bank_amount = 'At least one amount is required';
            } else {
                if (formData.cash_amount && (isNaN(formData.cash_amount) || parseFloat(formData.cash_amount) < 0)) {
                    newErrors.cash_amount = 'Amount must be valid and non-negative';
                }
                if (formData.bank_amount && (isNaN(formData.bank_amount) || parseFloat(formData.bank_amount) < 0)) {
                    newErrors.bank_amount = 'Amount must be valid and non-negative';
                }
            }
        } else {
            if (!formData.amount) {
                newErrors.amount = 'Amount is required';
            } else if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
                newErrors.amount = 'Amount must be greater than zero';
            }
        }

        // Cheque-specific fields validation when cheque is selected as payment method
        if (formData.cash_type === 'cheque') {
            if (!formData.cheque_number || !formData.cheque_number.trim()) {
                newErrors.cheque_number = 'Cheque number is required';
            } else if (formData.cheque_number.startsWith('AUTO-')) {
                newErrors.cheque_number = 'Cannot use AUTO- prefix for cheque numbers';
            }

            if (!formData.bank_name || !formData.bank_name.trim()) {
                newErrors.bank_name = 'Bank name is required';
            } else if (formData.bank_name.toLowerCase() === 'auto-generated') {
                newErrors.bank_name = 'Cannot use "Auto-generated" as bank name';
            }

            if (!formData.issue_date) newErrors.issue_date = 'Issue date is required';
            if (!formData.due_date) newErrors.due_date = 'Due date is required';

            // Validate that due date is not before issue date
            if (formData.issue_date && formData.due_date && new Date(formData.due_date) < new Date(formData.issue_date)) {
                newErrors.due_date = 'Due date cannot be before issue date';
            }

            // Validate against available bank balance considering pending cheques
            // This would be done on the backend, but we can add a warning here
            const sourceLedger = ledgerHeads.find(head => head.id.toString() === formData.source_ledger_head_id);
            if (sourceLedger && parseFloat(formData.amount) > parseFloat(sourceLedger.bank_balance || 0)) {
                newErrors.amount = `Insufficient bank funds. Available: ₹${parseFloat(sourceLedger.bank_balance || 0).toFixed(2)}`;
            }
        }

        // Check if source ledger has sufficient balance for non-cheque payment methods
        const sourceLedger = ledgerHeads.find(head => head.id.toString() === formData.source_ledger_head_id);
        if (sourceLedger && formData.cash_type !== 'cheque') {
            if (formData.cash_type === 'cash') {
                if (parseFloat(formData.amount) > parseFloat(sourceLedger.cash_balance || 0)) {
                    newErrors.amount = `Insufficient cash balance. Available: ${parseFloat(sourceLedger.cash_balance || 0).toFixed(2)}`;
                }
            } else if (formData.cash_type === 'bank') {
                if (parseFloat(formData.amount) > parseFloat(sourceLedger.bank_balance || 0)) {
                    newErrors.amount = `Insufficient bank balance. Available: ${parseFloat(sourceLedger.bank_balance || 0).toFixed(2)}`;
                }
            } else if (formData.cash_type === 'multiple') {
                if (parseFloat(formData.cash_amount || 0) > parseFloat(sourceLedger.cash_balance || 0)) {
                    newErrors.cash_amount = `Insufficient cash balance. Available: ${parseFloat(sourceLedger.cash_balance || 0).toFixed(2)}`;
                }
                if (parseFloat(formData.bank_amount || 0) > parseFloat(sourceLedger.bank_balance || 0)) {
                    newErrors.bank_amount = `Insufficient bank balance. Available: ${parseFloat(sourceLedger.bank_balance || 0).toFixed(2)}`;
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Format currency
    const formatCurrency = (amount) => {
        return parseFloat(amount).toFixed(2);
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
                ledger_head_id: parseInt(formData.ledger_head_id),
                amount: formData.cash_type === 'multiple'
                    ? calculateTotalAmount()
                    : parseFloat(formData.amount),
                tx_type: 'debit',
                cash_type: formData.cash_type,
                tx_date: formData.tx_date,
                description: formData.description || null,
                voucher_number: formData.voucher_number,
                manual_voucher: formData.manual_voucher
            };

            // For multiple cash type, add cash and bank amounts
            if (formData.cash_type === 'multiple') {
                transactionData.cash_amount = parseFloat(formData.cash_amount || 0);
                transactionData.bank_amount = parseFloat(formData.bank_amount || 0);
            }

            // For cheque type, add cheque details and set status to pending
            if (formData.cash_type === 'cheque') {
                transactionData.cheque_number = formData.cheque_number;
                transactionData.bank_name = formData.bank_name;
                transactionData.issue_date = formData.issue_date;
                transactionData.due_date = formData.due_date;
                transactionData.status = 'pending'; // Explicitly set status to pending for cheques
            }

            // Add source ledger head to sources array
            transactionData.sources = [{
                ledger_head_id: parseInt(formData.source_ledger_head_id),
                amount: formData.cash_type === 'multiple'
                    ? calculateTotalAmount()
                    : parseFloat(formData.amount)
            }];

            let response;
            if (isEditing) {
                // Update existing transaction
                response = await api.put(`/api/transactions/${formData.id}`, transactionData);
            } else {
                // Create new debit transaction
                response = await api.post('/api/transactions/debit', transactionData);
            }

            if (response.data && response.data.success) {
                // Call onSuccess callback
                if (onSuccess) {
                    onSuccess(response.data.data || response.data.transaction);
                }

                // Show success message
                const successMessage = formData.cash_type === 'cheque'
                    ? 'Pending cheque transaction created successfully'
                    : isEditing
                        ? 'Transaction updated successfully'
                        : 'Debit transaction created successfully';

                toast.success(successMessage, {
                    position: "top-right",
                    autoClose: 3000
                });
            } else {
                setError(response.data?.message || 'Failed to process transaction');
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

    // Update the validateAmount function to accept a specific ledger
    const validateAmount = (type, value, specificLedger = null) => {
        if (!value || parseFloat(value) <= 0) {
            return "Amount must be greater than zero";
        }

        // Use provided ledger or find from state
        const sourceLedger = specificLedger ||
            ledgerHeads.find(head => head.id.toString() === formData.source_ledger_head_id);

        if (!sourceLedger) return null;

        if (type === 'cash' && parseFloat(value) > parseFloat(sourceLedger.cash_balance || 0)) {
            return `Exceeds available cash balance (₹${parseFloat(sourceLedger.cash_balance || 0).toFixed(2)})`;
        }

        if ((type === 'bank' || type === 'cheque') && parseFloat(value) > parseFloat(sourceLedger.bank_balance || 0)) {
            return `Insufficient bank funds. Available: ₹${parseFloat(sourceLedger.bank_balance || 0).toFixed(2)}`;
        }

        return null;
    };

    // Create a styled banner for the balance display
    const BalanceBanner = ({ ledgerId }) => {
        const ledger = ledgerHeads.find(h => h.id.toString() === ledgerId);
        if (!ledger) return null;

        const totalBalance = parseFloat(ledger.current_balance || 0);
        const bankBalance = parseFloat(ledger.bank_balance || 0);
        const cashBalance = parseFloat(ledger.cash_balance || 0);

        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                        <div className="bg-indigo-100 p-1.5 rounded-full mr-2">
                            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <span className="text-indigo-800">Available Balance:</span>
                        <span className="ml-2 text-indigo-700 font-bold">{ledger.name}</span>
                    </h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-200">
                    <div className="p-5 text-center relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center justify-center">
                            <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            TOTAL BALANCE
                        </div>
                        <div className="text-2xl font-bold text-gray-800 mt-1">
                            ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="absolute -right-6 -bottom-6 opacity-5">
                            <svg className="w-20 h-20 text-gray-800" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                            </svg>
                        </div>
                    </div>
                    <div className="p-5 text-center relative overflow-hidden bg-gradient-to-b from-blue-50 to-white">
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center justify-center">
                            <svg className="w-3 h-3 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                            </svg>
                            CASH IN BANK
                        </div>
                        <div className={`text-2xl font-bold ${bankBalance > 0 ? 'text-blue-600' : 'text-gray-400'} mt-1`}>
                            ₹{bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="absolute -right-6 -bottom-6 opacity-5">
                            <svg className="w-20 h-20 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                    <div className="p-5 text-center relative overflow-hidden bg-gradient-to-b from-green-50 to-white">
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center justify-center">
                            <svg className="w-3 h-3 mr-1 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            CASH IN HAND
                        </div>
                        <div className={`text-2xl font-bold ${cashBalance > 0 ? 'text-green-600' : 'text-gray-400'} mt-1`}>
                            ₹{cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="absolute -right-6 -bottom-6 opacity-5">
                            <svg className="w-20 h-20 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Component to calculate and display projected balance
    const ProjectedBalance = ({ ledgerId, amountToDeduct, cashType }) => {
        const ledger = ledgerHeads.find(h => h.id.toString() === ledgerId);
        if (!ledger) return null;

        let newCashBalance = parseFloat(ledger.cash_balance || 0);
        let newBankBalance = parseFloat(ledger.bank_balance || 0);

        if (cashType === 'cash') {
            newCashBalance -= parseFloat(amountToDeduct || 0);
        } else if (cashType === 'bank') {
            newBankBalance -= parseFloat(amountToDeduct || 0);
        } else if (cashType === 'multiple') {
            newCashBalance -= parseFloat(formData.cash_amount || 0);
            newBankBalance -= parseFloat(formData.bank_amount || 0);
        }

        const isNegativeCash = newCashBalance < 0;
        const isNegativeBank = newBankBalance < 0;

        return (
            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
                <div className="text-xs font-medium mb-1">Projected Balance After Debit:</div>
                <div className="flex justify-between">
                    <div className={`flex items-center text-xs ${isNegativeCash ? 'text-red-600' : 'text-green-600'}`}>
                        <FaMoneyBillWave className="mr-1" />
                        <span>Cash: ₹{newCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {isNegativeCash && <span className="ml-1 text-xs bg-red-100 text-red-800 px-1 rounded">Insufficient</span>}
                    </div>
                    <div className={`flex items-center text-xs ${isNegativeBank ? 'text-red-600' : 'text-blue-600'}`}>
                        <FaUniversity className="mr-1" />
                        <span>Bank: ₹{newBankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {isNegativeBank && <span className="ml-1 text-xs bg-red-100 text-red-800 px-1 rounded">Insufficient</span>}
                    </div>
                </div>
            </div>
        );
    };

    // Add function to generate voucher number
    const generateVoucherNumber = () => {
        // This would typically fetch the next serial from the backend
        // For now, we'll simulate it with a random number as placeholder
        const serial = Math.floor(Math.random() * 500) + 1;
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = String(today.getFullYear()).slice(-2);

        return `CV-${serial}/${month}/${year}`;
    };

    // Set initial voucher number on component mount
    useEffect(() => {
        if (!isEditing && !formData.voucher_number) {
            setFormData(prev => ({
                ...prev,
                voucher_number: generateVoucherNumber()
            }));
        }
    }, []);

    // Handle voucher manual toggle
    const handleManualVoucherToggle = (e) => {
        const isManual = e.target.checked;
        setFormData(prev => ({
            ...prev,
            manual_voucher: isManual,
            // If toggling back to automatic, regenerate the voucher number
            voucher_number: !isManual ? generateVoucherNumber() : prev.voucher_number
        }));
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 max-w-6xl mx-auto">
            {/* Header with gradient background */}
            <div className="mb-8 pb-4 relative overflow-hidden rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 -mx-6 -mt-6 px-8 py-8 shadow-lg">
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold text-white flex items-center">
                        <FaMoneyBillWave className="mr-4 text-white opacity-90" />
                        {isEditing ? 'Edit Debit Transaction' : 'New Debit Transaction'}
                    </h2>
                    <p className="text-indigo-100 mt-3 text-base max-w-2xl opacity-90">
                        {isEditing
                            ? 'Edit the details of an existing debit transaction'
                            : 'Create a new debit transaction by filling out the form below'
                        }
                    </p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10">
                    <FaMoneyBillWave className="text-white text-9xl transform rotate-12" />
                </div>
                <div className="absolute -left-10 -bottom-10 opacity-10">
                    <svg className="w-32 h-32 text-white opacity-20" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="8" />
                    </svg>
                </div>
                <div className="absolute right-20 top-0 opacity-10">
                    <svg className="w-20 h-20 text-white opacity-20" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="8" />
                    </svg>
                </div>

                {/* Decorative elements */}
                <div className="absolute left-1/4 top-1/2 opacity-20">
                    <svg className="w-16 h-16 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                </div>
                <div className="absolute right-1/4 bottom-0 opacity-20">
                    <svg className="w-24 h-24 text-indigo-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>

            {/* Error message with improved styling */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 flex items-start animate-fadeIn">
                    <FaExclamationTriangle className="text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold mb-1">Error</h3>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Loading state with nicer animation */}
            {loading ? (
                <div className="flex flex-col justify-center items-center h-60 py-12">
                    <div className="relative">
                        <div className="h-12 w-12 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin"></div>
                        <div className="h-12 w-12 rounded-full border-r-2 border-l-2 border-purple-300 animate-spin absolute top-0 left-0" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                    </div>
                    <p className="mt-4 text-indigo-600 font-medium">Loading form data...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Account and Ledger Head Selections with improved styling */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Account Selection */}
                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md">
                            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
                                <span className="bg-indigo-100 text-indigo-700 p-1 rounded-full mr-2">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </span>
                                Account <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative" ref={accountDropdownRef}>
                                <div
                                    className="border-2 border-indigo-100 hover:border-indigo-300 rounded-lg p-2.5 flex justify-between items-center cursor-pointer bg-white shadow-sm transition-all duration-200"
                                    onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                                >
                                    <span className="font-medium text-gray-800">
                                        {formData.account_id
                                            ? accounts.find(a => a.id.toString() === formData.account_id)?.name || 'Select Account'
                                            : 'Select Account'
                                        }
                                    </span>
                                    <svg className={`w-4 h-4 text-indigo-500 transition-transform duration-200 ${isAccountDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                                {isAccountDropdownOpen && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto animate-fadeIn">
                                        <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <FaSearch className="h-4 w-4 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    placeholder="Search accounts..."
                                                    value={accountSearchQuery}
                                                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="py-1">
                                            {accounts
                                                .filter(account => account.name.toLowerCase().includes(accountSearchQuery.toLowerCase()))
                                                .map(account => (
                                                    <div
                                                        key={account.id}
                                                        className={`px-4 py-2.5 cursor-pointer hover:bg-indigo-50 flex items-center ${formData.account_id === account.id.toString() ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'}`}
                                                        onClick={() => handleAccountSelect(account)}
                                                    >
                                                        {formData.account_id === account.id.toString() && (
                                                            <svg className="w-4 h-4 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                        <span className={formData.account_id !== account.id.toString() ? "ml-6" : ""}>{account.name}</span>
                                                    </div>
                                                ))
                                            }
                                            {accounts.filter(account => account.name.toLowerCase().includes(accountSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No accounts found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {errors.account_id && <p className="text-red-500 text-xs mt-2 error-message">{errors.account_id}</p>}
                        </div>

                        {/* Source Ledger Head (Credit) */}
                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md">
                            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
                                <span className="bg-green-100 text-green-700 p-1 rounded-full mr-2">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </span>
                                Credit Head (From) <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative" ref={sourceLedgerDropdownRef}>
                                <div
                                    className={`border-2 border-green-100 hover:border-green-300 rounded-lg p-2.5 flex justify-between items-center cursor-pointer bg-white shadow-sm transition-all duration-200 ${!formData.account_id ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    onClick={() => formData.account_id && setIsSourceLedgerDropdownOpen(!isSourceLedgerDropdownOpen)}
                                >
                                    <span className="font-medium text-gray-800">
                                        {formData.source_ledger_head_id
                                            ? ledgerHeads.find(h => h.id.toString() === formData.source_ledger_head_id)?.name || 'Select Credit Head'
                                            : 'Select Credit Head'
                                        }
                                    </span>
                                    <svg className={`w-4 h-4 text-green-500 transition-transform duration-200 ${isSourceLedgerDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                                {isSourceLedgerDropdownOpen && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto animate-fadeIn">
                                        <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <FaSearch className="h-4 w-4 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    placeholder="Search credit heads..."
                                                    value={sourceLedgerSearchQuery}
                                                    onChange={(e) => setSourceLedgerSearchQuery(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="py-1">
                                            {creditLedgerHeads.map(ledger => (
                                                <div
                                                    key={ledger.id}
                                                    className={`px-4 py-2.5 cursor-pointer hover:bg-green-50 flex items-center ${formData.source_ledger_head_id === ledger.id.toString() ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-700'}`}
                                                    onClick={() => handleSourceLedgerSelect(ledger)}
                                                >
                                                    {formData.source_ledger_head_id === ledger.id.toString() && (
                                                        <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                    <span className={formData.source_ledger_head_id !== ledger.id.toString() ? "ml-6" : ""}>{ledger.name}</span>
                                                </div>
                                            ))}
                                            {creditLedgerHeads.length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No credit heads available</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {errors.source_ledger_head_id && <p className="text-red-500 text-xs mt-2 error-message">{errors.source_ledger_head_id}</p>}
                        </div>

                        {/* Destination Ledger Head (Debit) */}
                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md">
                            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
                                <span className="bg-purple-100 text-purple-700 p-1 rounded-full mr-2">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </span>
                                Debit Head (To) <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative" ref={debitLedgerDropdownRef}>
                                <div
                                    className={`border-2 border-purple-100 hover:border-purple-300 rounded-lg p-2.5 flex justify-between items-center cursor-pointer bg-white shadow-sm transition-all duration-200 ${!formData.account_id ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    onClick={() => formData.account_id && setIsDebitLedgerDropdownOpen(!isDebitLedgerDropdownOpen)}
                                >
                                    <span className="font-medium text-gray-800">
                                        {formData.ledger_head_id
                                            ? ledgerHeads.find(h => h.id.toString() === formData.ledger_head_id)?.name || 'Select Debit Head'
                                            : 'Select Debit Head'
                                        }
                                    </span>
                                    <svg className={`w-4 h-4 text-purple-500 transition-transform duration-200 ${isDebitLedgerDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                                {isDebitLedgerDropdownOpen && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto animate-fadeIn">
                                        <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <FaSearch className="h-4 w-4 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                    placeholder="Search debit heads..."
                                                    value={debitLedgerSearchQuery}
                                                    onChange={(e) => setDebitLedgerSearchQuery(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="py-1">
                                            {debitLedgerHeads.map(ledger => (
                                                <div
                                                    key={ledger.id}
                                                    className={`px-4 py-2.5 cursor-pointer hover:bg-purple-50 flex items-center ${formData.ledger_head_id === ledger.id.toString() ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700'}`}
                                                    onClick={() => handleDebitLedgerSelect(ledger)}
                                                >
                                                    {formData.ledger_head_id === ledger.id.toString() && (
                                                        <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                    <span className={formData.ledger_head_id !== ledger.id.toString() ? "ml-6" : ""}>{ledger.name}</span>
                                                </div>
                                            ))}
                                            {debitLedgerHeads.length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No debit heads available</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {errors.ledger_head_id && <p className="text-red-500 text-xs mt-2 error-message">{errors.ledger_head_id}</p>}
                        </div>
                    </div>

                    {/* Display Balance Banner after all selections are complete */}
                    {formData.source_ledger_head_id && (
                        <div className="mt-3 mb-3">
                            <BalanceBanner ledgerId={formData.source_ledger_head_id} />
                        </div>
                    )}

                    {/* Payment Method Radio Buttons - Redesigned */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <label htmlFor="cash_type" className="block text-sm font-semibold text-gray-700 mb-4 flex items-center">
                            <span className="bg-purple-100 text-purple-700 p-1.5 rounded-full mr-2">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </span>
                            Payment Method <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="grid grid-cols-4 gap-4">
                            <label className="payment-option cursor-pointer">
                                <input
                                    type="radio"
                                    name="cash_type"
                                    value="cash"
                                    checked={formData.cash_type === 'cash'}
                                    onChange={handleInputChange}
                                    className="sr-only"
                                />
                                <div className={`h-full flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-300 ${formData.cash_type === 'cash'
                                    ? 'bg-gradient-to-b from-green-50 to-green-100 border-2 border-green-500 shadow-md transform scale-105'
                                    : 'bg-white border-2 border-gray-200 hover:border-green-300 hover:bg-green-50'
                                    }`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${formData.cash_type === 'cash'
                                        ? 'bg-green-100'
                                        : 'bg-gray-100'
                                        }`}>
                                        <FaMoneyBillWave className={`w-5 h-5 ${formData.cash_type === 'cash'
                                            ? 'text-green-600'
                                            : 'text-gray-500'
                                            }`} />
                                    </div>
                                    <span className={`font-medium ${formData.cash_type === 'cash'
                                        ? 'text-green-700'
                                        : 'text-gray-700'
                                        }`}>Cash</span>
                                </div>
                            </label>

                            <label className="payment-option cursor-pointer">
                                <input
                                    type="radio"
                                    name="cash_type"
                                    value="bank"
                                    checked={formData.cash_type === 'bank'}
                                    onChange={handleInputChange}
                                    className="sr-only"
                                />
                                <div className={`h-full flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-300 ${formData.cash_type === 'bank'
                                    ? 'bg-gradient-to-b from-blue-50 to-blue-100 border-2 border-blue-500 shadow-md transform scale-105'
                                    : 'bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                    }`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${formData.cash_type === 'bank'
                                        ? 'bg-blue-100'
                                        : 'bg-gray-100'
                                        }`}>
                                        <FaUniversity className={`w-5 h-5 ${formData.cash_type === 'bank'
                                            ? 'text-blue-600'
                                            : 'text-gray-500'
                                            }`} />
                                    </div>
                                    <span className={`font-medium ${formData.cash_type === 'bank'
                                        ? 'text-blue-700'
                                        : 'text-gray-700'
                                        }`}>Bank</span>
                                </div>
                            </label>

                            <label className="payment-option cursor-pointer">
                                <input
                                    type="radio"
                                    name="cash_type"
                                    value="multiple"
                                    checked={formData.cash_type === 'multiple'}
                                    onChange={handleInputChange}
                                    className="sr-only"
                                />
                                <div className={`h-full flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-300 ${formData.cash_type === 'multiple'
                                    ? 'bg-gradient-to-b from-purple-50 to-purple-100 border-2 border-purple-500 shadow-md transform scale-105'
                                    : 'bg-white border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                                    }`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${formData.cash_type === 'multiple'
                                        ? 'bg-purple-100'
                                        : 'bg-gray-100'
                                        }`}>
                                        <FaExchangeAlt className={`w-5 h-5 ${formData.cash_type === 'multiple'
                                            ? 'text-purple-600'
                                            : 'text-gray-500'
                                            }`} />
                                    </div>
                                    <span className={`font-medium ${formData.cash_type === 'multiple'
                                        ? 'text-purple-700'
                                        : 'text-gray-700'
                                        }`}>Both</span>
                                </div>
                            </label>

                            <label className="payment-option cursor-pointer">
                                <input
                                    type="radio"
                                    name="cash_type"
                                    value="cheque"
                                    checked={formData.cash_type === 'cheque'}
                                    onChange={handleInputChange}
                                    className="sr-only"
                                />
                                <div className={`h-full flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-300 ${formData.cash_type === 'cheque'
                                    ? 'bg-gradient-to-b from-amber-50 to-amber-100 border-2 border-amber-500 shadow-md transform scale-105'
                                    : 'bg-white border-2 border-gray-200 hover:border-amber-300 hover:bg-amber-50'
                                    }`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${formData.cash_type === 'cheque'
                                        ? 'bg-amber-100'
                                        : 'bg-gray-100'
                                        }`}>
                                        <FaMoneyCheck className={`w-5 h-5 ${formData.cash_type === 'cheque'
                                            ? 'text-amber-600'
                                            : 'text-gray-500'
                                            }`} />
                                    </div>
                                    <span className={`font-medium ${formData.cash_type === 'cheque'
                                        ? 'text-amber-700'
                                        : 'text-gray-700'
                                        }`}>Cheque</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Amount Inputs - Conditional based on cash_type */}
                    {formData.cash_type === 'multiple' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                                <label htmlFor="cash_amount" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                    <span className="bg-green-100 text-green-700 p-2 rounded-full mr-2 flex items-center justify-center">
                                        <FaMoneyBillWave className="w-4 h-4" />
                                    </span>
                                    Cash Amount <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="relative mt-2">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-lg font-medium">₹</span>
                                    </div>
                                    <input
                                        id="cash_amount"
                                        type="number"
                                        name="cash_amount"
                                        value={formData.cash_amount || ''}
                                        onChange={handleInputChange}
                                        onBlur={(e) => {
                                            if (e.target.value) {
                                                const error = validateAmount('cash', e.target.value);
                                                setErrors(prev => ({ ...prev, cash_amount: error }));
                                            } else if (formData.bank_amount === '' || parseFloat(formData.bank_amount || 0) <= 0) {
                                                setErrors(prev => ({ ...prev, cash_amount: 'At least one amount is required' }));
                                            }
                                        }}
                                        className={`w-full pl-10 pr-4 py-3.5 border-2 text-lg rounded-xl ${errors.cash_amount ? 'border-red-300 bg-red-50' : 'border-green-200 focus:border-green-500 bg-green-50 bg-opacity-30'} focus:outline-none focus:ring-2 focus:ring-green-200 transition-all duration-200`}
                                        placeholder="Enter cash amount"
                                    />
                                </div>
                                {errors.cash_amount && (
                                    <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                        <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {errors.cash_amount}
                                    </div>
                                )}
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                                <label htmlFor="bank_amount" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                    <span className="bg-blue-100 text-blue-700 p-2 rounded-full mr-2 flex items-center justify-center">
                                        <FaUniversity className="w-4 h-4" />
                                    </span>
                                    Bank Amount <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="relative mt-2">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-lg font-medium">₹</span>
                                    </div>
                                    <input
                                        id="bank_amount"
                                        type="number"
                                        name="bank_amount"
                                        value={formData.bank_amount || ''}
                                        onChange={handleInputChange}
                                        onBlur={(e) => {
                                            if (e.target.value) {
                                                const error = validateAmount('bank', e.target.value);
                                                setErrors(prev => ({ ...prev, bank_amount: error }));
                                            } else if (formData.cash_amount === '' || parseFloat(formData.cash_amount || 0) <= 0) {
                                                setErrors(prev => ({ ...prev, bank_amount: 'At least one amount is required' }));
                                            }
                                        }}
                                        className={`w-full pl-10 pr-4 py-3.5 border-2 text-lg rounded-xl ${errors.bank_amount ? 'border-red-300 bg-red-50' : 'border-blue-200 focus:border-blue-500 bg-blue-50 bg-opacity-30'} focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-200`}
                                        placeholder="Enter bank amount"
                                    />
                                </div>
                                {errors.bank_amount && (
                                    <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                        <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {errors.bank_amount}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : formData.cash_type === 'cheque' ? (
                        <div className="space-y-6 animate-fadeIn">
                            {/* Cheque Amount */}
                            <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition-all duration-200">
                                <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                    <span className="bg-amber-100 text-amber-700 p-2 rounded-full mr-2 flex items-center justify-center">
                                        <FaMoneyCheck className="w-4 h-4" />
                                    </span>
                                    Cheque Amount <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="relative mt-2">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-lg font-medium">₹</span>
                                    </div>
                                    <input
                                        id="amount"
                                        type="number"
                                        name="amount"
                                        value={formData.amount || ''}
                                        onChange={handleInputChange}
                                        onBlur={(e) => {
                                            if (!e.target.value || parseFloat(e.target.value) <= 0) {
                                                setErrors(prev => ({ ...prev, amount: 'Amount must be greater than zero' }));
                                            } else {
                                                // For cheques, validate against bank balance
                                                const error = validateAmount('cheque', e.target.value);
                                                setErrors(prev => ({ ...prev, amount: error }));
                                            }
                                        }}
                                        className={`w-full pl-10 pr-4 py-3.5 border-2 text-lg rounded-xl ${errors.amount ? 'border-red-300 bg-red-50' : 'border-amber-200 focus:border-amber-500 bg-amber-50 bg-opacity-30'} focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all duration-200`}
                                        placeholder="Enter cheque amount"
                                    />
                                </div>
                                {errors.amount && (
                                    <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                        <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {errors.amount}
                                    </div>
                                )}
                            </div>

                            {/* Cheque details section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <label htmlFor="cheque_number" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                        <span className="bg-yellow-100 text-yellow-700 p-1.5 rounded-full mr-2">
                                            <FaHashtag className="w-3.5 h-3.5" />
                                        </span>
                                        Cheque Number <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <input
                                        id="cheque_number"
                                        type="text"
                                        name="cheque_number"
                                        value={formData.cheque_number || ''}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg ${errors.cheque_number ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                        placeholder="Enter cheque number"
                                    />
                                    {errors.cheque_number && (
                                        <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                            <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {errors.cheque_number}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <label htmlFor="bank_name" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                        <span className="bg-blue-100 text-blue-700 p-1.5 rounded-full mr-2">
                                            <FaUniversity className="w-3.5 h-3.5" />
                                        </span>
                                        Bank Name <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <input
                                        id="bank_name"
                                        type="text"
                                        name="bank_name"
                                        value={formData.bank_name || ''}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg ${errors.bank_name ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                        placeholder="Enter bank name"
                                    />
                                    {errors.bank_name && (
                                        <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                            <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {errors.bank_name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <label htmlFor="issue_date" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                        <span className="bg-green-100 text-green-700 p-1.5 rounded-full mr-2">
                                            <FaCalendarAlt className="w-3.5 h-3.5" />
                                        </span>
                                        Issue Date <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <input
                                        id="issue_date"
                                        type="date"
                                        name="issue_date"
                                        value={formData.issue_date || ''}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg ${errors.issue_date ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                    />
                                    {errors.issue_date && (
                                        <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                            <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {errors.issue_date}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <label htmlFor="due_date" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                        <span className="bg-red-100 text-red-700 p-1.5 rounded-full mr-2">
                                            <FaCalendarAlt className="w-3.5 h-3.5" />
                                        </span>
                                        Due Date <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <input
                                        id="due_date"
                                        type="date"
                                        name="due_date"
                                        value={formData.due_date || ''}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg ${errors.due_date ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                    />
                                    {errors.due_date && (
                                        <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                            <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {errors.due_date}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Note about cheque transactions */}
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <FaInfoCircle className="h-5 w-5 text-yellow-500" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-yellow-700">
                                            This transaction will be saved as a <strong>pending cheque</strong>. The balance won't be affected until the cheque is cleared.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                            <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                <span className={`p-2 rounded-full mr-2 flex items-center justify-center ${formData.cash_type === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {formData.cash_type === 'cash' ? <FaMoneyBillWave className="w-4 h-4" /> : <FaUniversity className="w-4 h-4" />}
                                </span>
                                Amount <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative mt-2">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-lg font-medium">₹</span>
                                </div>
                                <input
                                    id="amount"
                                    type="number"
                                    name="amount"
                                    value={formData.amount || ''}
                                    onChange={handleInputChange}
                                    onBlur={(e) => {
                                        if (!e.target.value || parseFloat(e.target.value) <= 0) {
                                            setErrors(prev => ({ ...prev, amount: 'Amount must be greater than zero' }));
                                        } else {
                                            const error = validateAmount(formData.cash_type, e.target.value);
                                            setErrors(prev => ({ ...prev, amount: error }));
                                        }
                                    }}
                                    className={`w-full pl-10 pr-4 py-3.5 border-2 text-lg rounded-xl ${errors.amount
                                        ? 'border-red-300 bg-red-50'
                                        : formData.cash_type === 'cash'
                                            ? 'border-green-200 focus:border-green-500 bg-green-50 bg-opacity-30 focus:ring-green-200'
                                            : 'border-blue-200 focus:border-blue-500 bg-blue-50 bg-opacity-30 focus:ring-blue-200'
                                        } focus:outline-none focus:ring-2 transition-all duration-200`}
                                    placeholder="Enter amount"
                                />
                            </div>
                            {errors.amount && (
                                <div className="mt-2 flex items-center text-red-600 text-xs animate-fadeIn">
                                    <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {errors.amount}
                                </div>
                            )}
                        </div>
                    )}{/* Voucher, Date and Description - All in one row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        {/* Voucher Number */}
                        <div>
                            <label className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                                <span>Voucher Number *</span>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="manual_voucher"
                                        name="manual_voucher"
                                        checked={formData.manual_voucher}
                                        onChange={handleManualVoucherToggle}
                                        className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="manual_voucher" className="text-xs text-gray-600">
                                        Allot Manually
                                    </label>
                                </div>
                            </label>
                            <div className="relative">
                                {formData.manual_voucher ? (
                                    <input
                                        type="text"
                                        name="voucher_number"
                                        id="voucher_number"
                                        value={formData.voucher_number}
                                        onChange={handleInputChange}
                                        placeholder="CV-serial/MM/YY"
                                        className={`w-full p-2 border ${errors.voucher_number ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                                        aria-invalid={!!errors.voucher_number}
                                        aria-describedby={errors.voucher_number ? "voucher_error" : undefined}
                                    />
                                ) : (
                                    <div className="bg-gray-100 border border-gray-200 rounded-full px-4 py-2 text-center font-medium text-gray-700">
                                        {formData.voucher_number}
                                    </div>
                                )}
                            </div>
                            {errors.voucher_number && (
                                <p id="voucher_error" className="text-red-500 text-xs mt-1 error-message">{errors.voucher_number}</p>
                            )}
                        </div>

                        {/* Transaction Date */}
                        <div>
                            <label htmlFor="tx_date" className="block text-xs font-medium text-gray-700 mb-1">
                                <FaCalendarAlt className="inline mr-2 text-gray-500 w-3 h-3" />
                                Transaction Date *
                            </label>
                            <div className="relative">
                                <input
                                    id="tx_date"
                                    type="date"
                                    name="tx_date"
                                    value={formData.tx_date}
                                    onChange={handleInputChange}
                                    className={`w-full p-2 border ${errors.tx_date ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                                    aria-invalid={!!errors.tx_date}
                                    aria-describedby={errors.tx_date ? "date_error" : undefined}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = new Date().toISOString().split('T')[0];
                                        setFormData(prev => ({ ...prev, tx_date: today }));
                                    }}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                                >
                                    Today
                                </button>
                                {/* Display formatted date for better readability */}
                                {formData.tx_date && (
                                    <div className="text-xs mt-1 text-gray-500">
                                        {new Date(formData.tx_date).toLocaleDateString('en-IN', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        }).replace(/\//g, '-')}
                                    </div>
                                )}
                            </div>
                            {errors.tx_date && (
                                <p id="date_error" className="text-red-500 text-xs mt-1 error-message" aria-live="polite">{errors.tx_date}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
                                Description (Optional)
                            </label>
                            <div className="relative">
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Example: Purchase of office supplies"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    rows="2"
                                    maxLength="120"
                                    aria-describedby="desc_counter"
                                ></textarea>
                                <div id="desc_counter" className="text-xs text-gray-500 text-right mt-1">
                                    {formData.description.length}/120 characters
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end space-x-5 mt-10 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 flex items-center font-medium transition-all duration-200 shadow-sm hover:shadow"
                            disabled={submitting}
                        >
                            <FaTimes className="mr-2 text-gray-500" />
                            <span>Cancel</span>
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl text-white flex items-center font-medium shadow-md hover:shadow-lg transition-all duration-200"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <div className="flex items-center">
                                    <div className="w-5 h-5 mr-3 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                                    <span>{isEditing ? 'Updating...' : 'Saving...'}</span>
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    <FaSave className="mr-2" />
                                    <span>{isEditing ? 'Update Transaction' : 'Save Transaction'}</span>
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Additional note about balance changes */}
                    {formData.source_ledger_head_id && formData.ledger_head_id && (
                        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700">
                            <div className="flex items-start">
                                <div className="bg-indigo-100 p-2 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                                    <FaInfoCircle className="text-indigo-500" />
                                </div>
                                <div>
                                    <p className="font-medium mb-1">Balance Changes Summary:</p>
                                    <p>Funds will be transferred from <span className="font-semibold text-indigo-800">{ledgerHeads.find(h => h.id.toString() === formData.source_ledger_head_id)?.name || ''}</span> to <span className="font-semibold text-indigo-800">{ledgerHeads.find(h => h.id.toString() === formData.ledger_head_id)?.name || ''}</span>.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            )}

            {/* Additional balance displays and projected balances */}
            {formData.source_ledger_head_id && formData.amount && formData.cash_type !== 'multiple' && (
                <ProjectedBalance
                    ledgerId={formData.source_ledger_head_id}
                    amountToDeduct={formData.amount}
                    cashType={formData.cash_type}
                />
            )}

            {formData.source_ledger_head_id && formData.cash_type === 'multiple' &&
                (formData.cash_amount || formData.bank_amount) && (
                    <ProjectedBalance
                        ledgerId={formData.source_ledger_head_id}
                        cashType="multiple"
                    />
                )}

            {/* Total Amount Display for Both */}
            {formData.cash_type === 'multiple' && (formData.cash_amount || formData.bank_amount) && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-200 shadow-sm animate-fadeIn hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mr-4 shadow-sm">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <span className="text-base font-medium text-gray-700">Total Amount:</span>
                        </div>
                        <span className="text-2xl font-bold text-indigo-700">
                            ₹{(parseFloat(formData.cash_amount || 0) + parseFloat(formData.bank_amount || 0)).toFixed(2)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
} 
