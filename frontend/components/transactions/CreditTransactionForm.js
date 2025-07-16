import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    FaSave,
    FaTimes,
    FaMoneyBillWave,
    FaUniversity,
    FaExclamationTriangle,
    FaArrowLeft,
    FaSearch,
    FaCalendarAlt,
    FaRupeeSign,
    FaUser,
    FaBook,
    FaReceipt,
    FaRegCreditCard,
    FaLayerGroup,
    FaCheckCircle,
    FaLock
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

export default function CreditTransactionForm({ onSuccess, onCancel, transaction = null, isEditing = false }) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Form data
    const [formData, setFormData] = useState({
        account_id: '',
        ledger_head_id: '',
        donor_id: '',
        booklet_id: '',
        receipt_no: '',
        amount: '',
        bank_amount: '',
        cash_amount: '',
        cash_type: 'cash',
        tx_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
        description: '',
        splits: []
    });

    // Form validation errors
    const [errors, setErrors] = useState({});

    // Search filters
    const [bookletSearchQuery, setBookletSearchQuery] = useState('');

    // Options for dropdowns
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [donors, setDonors] = useState([]);
    const [booklets, setBooklets] = useState([]);

    // Period closure fields
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [showAdminOverrideModal, setShowAdminOverrideModal] = useState(false);
    const [isAdmin, setIsAdmin] = useState(true); // In a real app, this would come from auth

    // Add these state variables for searchable dropdowns
    const [accountSearchQuery, setAccountSearchQuery] = useState('');
    const [ledgerHeadSearchQuery, setLedgerHeadSearchQuery] = useState('');
    const [donorSearchQuery, setDonorSearchQuery] = useState('');
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const [isLedgerDropdownOpen, setIsLedgerDropdownOpen] = useState(false);
    const [isDonorDropdownOpen, setIsDonorDropdownOpen] = useState(false);

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: 8000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Add useEffect and useRef for handling closing dropdowns when clicking outside
    const accountDropdownRef = useRef(null);
    const ledgerDropdownRef = useRef(null);
    const donorDropdownRef = useRef(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            // Account dropdown
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
                setIsAccountDropdownOpen(false);
            }

            // Ledger head dropdown
            if (ledgerDropdownRef.current && !ledgerDropdownRef.current.contains(event.target)) {
                setIsLedgerDropdownOpen(false);
            }

            // Donor dropdown
            if (donorDropdownRef.current && !donorDropdownRef.current.contains(event.target)) {
                setIsDonorDropdownOpen(false);
            }
        }

        // Add event listener
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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

    // Create a styled banner for the balance display
    const BalanceBanner = ({ ledgerId }) => {
        const ledger = ledgerHeads.find(h => h.id.toString() === ledgerId);
        if (!ledger) return null;

        const bankBalance = parseFloat(ledger.bank_balance || 0);
        const cashBalance = parseFloat(ledger.cash_balance || 0);
        // Calculate total as sum of cash and bank balance, not using current_balance which may be outdated
        const totalBalance = cashBalance + bankBalance;

        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
                <div className="px-5 py-4 bg-gradient-to-r from-green-50 via-teal-50 to-green-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                        <div className="bg-green-100 p-1.5 rounded-full mr-2">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <span className="text-green-800">{ledger.head_type === 'credit' ? 'Income Balance' : 'Available Balance'}:</span>
                        <span className="ml-2 text-green-700 font-bold">{ledger.name}</span>
                    </h3>
                </div>
                {ledger.head_type === 'debit' ? (
                    // For debit heads, only show the total amount
                    <div className="p-5 text-center relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                        <div className="text-xs text-red-500 uppercase font-semibold mb-2 flex items-center justify-center">
                            <svg className="w-3 h-3 mr-1 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            EXPENSE AMOUNT
                        </div>
                        <div className="text-3xl font-bold text-red-600 mt-2">
                            ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                            Total expenses for this category
                        </div>
                        <div className="absolute -right-6 -bottom-6 opacity-5">
                            <svg className="w-20 h-20 text-red-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                            </svg>
                        </div>
                    </div>
                ) : (
                    // For credit heads, show the detailed breakdown with cash/bank split
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
                )}
            </div>
        );
    };

    // Fetch all necessary data (accounts, ledger heads, donors, booklets)
    const fetchFormData = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Starting to fetch form data...');

            // Fetch all data in parallel with better error handling
            try {
                console.log('Sending API requests...');
                const [accountsRes, ledgerHeadsRes, donorsRes, bookletsRes] = await Promise.all([
                    api.get(`${API_CONFIG.API_PREFIX}/accounts`),
                    api.get(`${API_CONFIG.API_PREFIX}/ledger-heads`),
                    api.get(`${API_CONFIG.API_PREFIX}/donors`),
                    api.get(`${API_CONFIG.API_PREFIX}/booklets`, { params: { is_active: true } })
                ]);

                const accountsData = accountsRes.data?.data || [];
                const ledgerHeadsData = ledgerHeadsRes.data?.data || [];
                const donorsData = donorsRes.data?.data || [];
                const bookletsData = bookletsRes.data?.data || [];

                // Debug logs
                console.log('Loaded data counts:', {
                    accounts: accountsData.length,
                    ledgerHeads: ledgerHeadsData.length,
                    donors: donorsData.length,
                    booklets: bookletsData.length
                });

                // Process booklets data to ensure pages_left is always an array of integers
                if (bookletsData.length > 0) {
                    console.log('First booklet sample (raw):', JSON.stringify(bookletsData[0]));

                    bookletsData.forEach((booklet, index) => {
                        console.log(`Processing booklet ${index}:`, {
                            id: booklet.id,
                            booklet_no: booklet.booklet_no,
                            pages_left_type: typeof booklet.pages_left,
                            pages_left: typeof booklet.pages_left === 'string' ?
                                `String[${booklet.pages_left.length}]` :
                                Array.isArray(booklet.pages_left) ?
                                    `Array[${booklet.pages_left.length}]` :
                                    'unknown'
                        });

                        // Handle cases where pages_left might be a string (JSON)
                        if (typeof booklet.pages_left === 'string') {
                            try {
                                console.log(`Parsing pages_left string for booklet ${booklet.id}: "${booklet.pages_left}"`);
                                booklet.pages_left = JSON.parse(booklet.pages_left);
                                console.log(`Successfully parsed pages_left for booklet ${booklet.id}:`, booklet.pages_left);
                            } catch (e) {
                                console.error(`Failed to parse pages_left for booklet ${booklet.id}:`, e);
                                booklet.pages_left = [];
                            }
                        }

                        // If pages_left is missing or empty but we have start_no and end_no, generate it
                        if ((!booklet.pages_left || booklet.pages_left.length === 0) &&
                            booklet.start_no !== undefined && booklet.end_no !== undefined) {
                            const start = parseInt(booklet.start_no);
                            const end = parseInt(booklet.end_no);
                            if (!isNaN(start) && !isNaN(end) && start <= end) {
                                console.log(`Generating pages_left for booklet ${booklet.id} from range ${start}-${end}`);
                                booklet.pages_left = Array.from(
                                    { length: end - start + 1 },
                                    (_, i) => start + i
                                );
                                console.log(`Generated ${booklet.pages_left.length} pages for booklet ${booklet.id}`);
                            }
                        }

                        // Ensure pages_left is always an array of integers
                        if (booklet.pages_left && Array.isArray(booklet.pages_left)) {
                            console.log(`Normalizing pages_left for booklet ${booklet.id}`);
                            booklet.pages_left = booklet.pages_left.map(page =>
                                typeof page === 'string' ? parseInt(page, 10) : page
                            );
                            console.log(`Final pages_left for booklet ${booklet.id}:`, booklet.pages_left);
                        } else {
                            console.log(`Setting empty pages_left array for booklet ${booklet.id}`);
                            booklet.pages_left = [];
                        }
                    });

                    console.log('Processed all booklets. First booklet after processing:',
                        bookletsData.length > 0 ? {
                            id: bookletsData[0].id,
                            booklet_no: bookletsData[0].booklet_no,
                            pages_left: bookletsData[0].pages_left
                        } : 'No booklets available');
                }

                console.log('Setting state with processed data...');
                setAccounts(accountsData);
                setLedgerHeads(ledgerHeadsData);
                setDonors(donorsData);
                setBooklets(bookletsData);

                // If editing, initialize form with transaction data
                if (isEditing && transaction) {
                    console.log('Initializing form with transaction data for editing:', {
                        transaction,
                        formData: {
                            account_id: transaction.account_id?.toString() || '',
                            ledger_head_id: transaction.ledger_head_id?.toString() || '',
                            donor_id: transaction.donor_id?.toString() || ''
                        },
                        accounts,
                        ledgerHeads,
                        donors
                    });
                } else if (accountsData.length > 0) {
                    // For new transactions, set default account and credit ledger head
                    const defaultAccount = accountsData[0].id;

                    // Find the first credit ledger head for this account
                    const defaultCreditLedger = ledgerHeadsData.find(
                        head => head.account_id.toString() === defaultAccount.toString() &&
                            head.head_type === 'credit'
                    );

                    console.log('Setting default credit ledger:', {
                        defaultAccount,
                        defaultCreditLedger: defaultCreditLedger ? defaultCreditLedger.id : 'None found'
                    });

                    // Set default values for new transaction
                    setFormData(prev => ({
                        ...prev,
                        account_id: defaultAccount.toString(),
                        ledger_head_id: defaultCreditLedger ? defaultCreditLedger.id.toString() : '',
                        tx_date: new Date().toISOString().split('T')[0]
                    }));
                }

                // This should be added to the fetchFormData function, after loading accounts data
                if (accountsData.length > 0) {
                    // Get selected account details if account is selected
                    if (formData.account_id) {
                        const selectedAccount = accountsData.find(acc => acc.id === parseInt(formData.account_id));
                        if (selectedAccount && selectedAccount.last_closed_date) {
                            // Store the last closed date for date validation
                            setSelectedAccount(selectedAccount);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching form data:', error);
                setError('Failed to load required data. Please try again.');
            }
        } catch (err) {
            console.error('Error fetching form data:', err);

            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                setError(`Failed to load form data: ${err.response.status} ${err.response.statusText}`);
            } else {
                setError(`Failed to load form data: ${err.message}`);
            }
        } finally {
            setLoading(false);
            console.log('Form data fetch complete (loading set to false)');
        }
    };

    // Load data on component mount
    useEffect(() => {
        fetchFormData();
    }, []);

    // Add this useEffect after the existing useEffect for fetchFormData() around line 397
    // This will ensure dropdown values are correctly displayed after data is loaded
    useEffect(() => {
        if (isEditing && transaction && accounts.length > 0 && ledgerHeads.length > 0) {
            console.log('Dropdown data loaded, refreshing form data to ensure values display correctly');

            // Re-set the form data to force dropdown display update
            setFormData(prevData => ({
                ...prevData,
                account_id: transaction.account_id?.toString() || '',
                ledger_head_id: transaction.ledger_head_id?.toString() || '',
                donor_id: transaction.donor_id?.toString() || '',
            }));
        }
    }, [accounts, ledgerHeads, donors, isEditing, transaction]);

    // Filter donors based on search query
    const filteredDonors = useMemo(() => {
        return donors.filter(donor =>
            donor && donor.name && donor.name.toLowerCase().includes(donorSearchQuery.toLowerCase())
        );
    }, [donors, donorSearchQuery]);

    // Filter accounts based on search query
    const filteredAccounts = useMemo(() => {
        return accounts.filter(account =>
            account && account.name && account.name.toLowerCase().includes(accountSearchQuery.toLowerCase())
        );
    }, [accounts, accountSearchQuery]);

    // Filter ledger heads based on account and search query
    const filteredLedgerHeads = useMemo(() => {
        return ledgerHeads.filter(head =>
            head &&
            head.account_id === formData.account_id &&
            head.head_type === 'credit' && // Only show credit type ledger heads
            head.name &&
            head.name.toLowerCase().includes(ledgerHeadSearchQuery.toLowerCase())
        );
    }, [ledgerHeads, formData.account_id, ledgerHeadSearchQuery]);

    // Filter active booklets (with pages left)
    const filteredActiveBooklets = (booklets) => {
        return booklets.filter(booklet => {
            if (!booklet) return false;

            // First check if the booklet is active
            if (!booklet.is_active) {
                console.log(`Skipping inactive booklet ${booklet.id} (${booklet.booklet_no})`);
                return false;
            }

            // Then check if it has pages left
            if (booklet.pages_left &&
                ((Array.isArray(booklet.pages_left) && booklet.pages_left.length > 0) ||
                    (typeof booklet.pages_left === 'string' && booklet.pages_left.trim() !== ''))) {
                return true;
            }

            // If pages_left is empty, mark as inactive even if is_active flag is true
            if (booklet.pages_left && Array.isArray(booklet.pages_left) && booklet.pages_left.length === 0) {
                console.log(`Skipping booklet ${booklet.id} (${booklet.booklet_no}) with no pages left`);
                return false;
            }

            // If pages_left is missing/empty but we have start_no and end_no, consider it active
            if (booklet.start_no !== undefined && booklet.end_no !== undefined) {
                const start = parseInt(booklet.start_no);
                const end = parseInt(booklet.end_no);
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    return true;
                }
            }

            return false;
        });
    };

    // Make sure to use the filtered active booklets function
    const activeBooklets = filteredActiveBooklets(booklets);

    // Sort booklets by number
    const sortedBooklets = [...activeBooklets].sort((a, b) => {
        // Add null checks to prevent errors
        if (!a || !b) return 0;
        if (!a.booklet_no) return 1;  // Put items without booklet numbers at the end
        if (!b.booklet_no) return -1;

        // Extract numeric part of booklet number if possible
        const numA = parseInt((a.booklet_no || '').replace(/\D/g, ''));
        const numB = parseInt((b.booklet_no || '').replace(/\D/g, ''));

        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        // Fall back to alphabetical sorting
        return (a.booklet_no || '').localeCompare(b.booklet_no || '');
    });

    // Filter booklets by search query
    const filteredBooklets = sortedBooklets.filter(booklet => {
        if (!booklet || !bookletSearchQuery) return true;
        const searchLower = bookletSearchQuery.toLowerCase();

        // Search in booklet_no
        if (booklet.booklet_no && booklet.booklet_no.toLowerCase().includes(searchLower)) return true;

        // Search in receipt numbers
        if (booklet.start_no && booklet.end_no &&
            (`${booklet.start_no}-${booklet.end_no}`).includes(searchLower)) return true;

        return false;
    });

    // Get or generate the available receipt numbers for the selected booklet
    function getAvailableReceiptNumbers(booklet) {
        if (!booklet) return [];

        // If pages_left exists and is an array with items, use it
        if (booklet.pages_left && Array.isArray(booklet.pages_left) && booklet.pages_left.length > 0) {
            // Convert all values to strings for consistency and sort them numerically
            const pages = booklet.pages_left
                .map(num => num.toString())
                .sort((a, b) => parseInt(a) - parseInt(b));

            console.log('Available receipt numbers for booklet', booklet.id, ':', pages);
            return pages;
        }

        // If we have start_no and end_no, generate the range
        if (booklet.start_no !== undefined && booklet.end_no !== undefined) {
            const start = parseInt(booklet.start_no);
            const end = parseInt(booklet.end_no);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                const pages = Array.from(
                    { length: end - start + 1 },
                    (_, i) => (start + i).toString()
                );
                console.log('Generated receipt numbers for booklet', booklet.id, ':', pages);
                return pages;
            }
        }

        console.warn('No receipt numbers found for booklet', booklet.id);
        return [];
    }

    // Get the currently selected booklet
    const selectedBooklet = booklets.find(b => b && b.id.toString() === formData.booklet_id?.toString()) || null;

    // Generate receipt numbers for the selected booklet
    const availableReceiptNumbers = useMemo(() => {
        if (!selectedBooklet) return [];
        return getAvailableReceiptNumbers(selectedBooklet);
    }, [selectedBooklet]);

    // Handle input change
    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        let updatedValue = value;

        // Reset receipt_no if booklet changes
        if (name === 'booklet_id') {
            setFormData(prev => ({
                ...prev,
                [name]: value,
                receipt_no: ''
            }));
            return;
        }

        if (name === 'tx_date') {
            // Check if this date is in a closed period when date is changed
            const selectedDate = new Date(value);

            // If we have the selected account with a last_closed_date
            if (selectedAccount && selectedAccount.last_closed_date) {
                const lastClosedDate = new Date(selectedAccount.last_closed_date);

                // Set both dates to start of day for accurate comparison
                selectedDate.setHours(0, 0, 0, 0);
                lastClosedDate.setHours(0, 0, 0, 0);

                // If the selected date is on or before the last closed date
                if (selectedDate <= lastClosedDate) {
                    // Add validation error
                    setErrors(prev => ({
                        ...prev,
                        tx_date: `This date falls in a closed accounting period. Periods up to ${formatDate(selectedAccount.last_closed_date)} are locked.`
                    }));
                } else {
                    // Clear validation error if it was set
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.tx_date;
                        return newErrors;
                    });
                }
            }
        }

        // For cash_type = 'multiple', reset amount since it's computed
        if (name === 'cash_type') {
            if (value === 'multiple') {
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    amount: '',
                    bank_amount: '',
                    cash_amount: ''
                }));
                return;
            } else {
                // When switching away from multiple, clear bank_amount and cash_amount
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    bank_amount: '',
                    cash_amount: ''
                }));
                return;
            }
        }

        // Special handling for amount fields to enforce numeric values
        if (name === 'amount' || name === 'bank_amount' || name === 'cash_amount') {
            // Allow empty string, numbers, and decimal point
            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                if (formData.cash_type === 'multiple' && name === 'amount') {
                    // Don't update the amount field directly for multiple payment type
                    return;
                }

                updatedValue = value;
            } else {
                // Invalid input, don't update state
                return;
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: updatedValue
        }));

        // Clear specific error when field is updated
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        // Required fields validation
        if (!formData.account_id) newErrors.account_id = 'Account is required';
        if (!formData.ledger_head_id) newErrors.ledger_head_id = 'Ledger Head is required';

        // Amount validation
        if (formData.cash_type === 'multiple') {
            if (!formData.cash_amount && !formData.bank_amount) {
                newErrors.cash_amount = 'At least one payment amount is required';
                newErrors.bank_amount = 'At least one payment amount is required';
            } else {
                const cashAmount = parseFloat(formData.cash_amount) || 0;
                const bankAmount = parseFloat(formData.bank_amount) || 0;
                if (cashAmount + bankAmount <= 0) {
                    newErrors.amount = 'Total amount must be greater than zero';
                }
            }
        } else {
            if (!formData.amount || parseFloat(formData.amount) <= 0) {
                newErrors.amount = 'Amount must be greater than zero';
            }
        }

        // Receipt related validations
        if (formData.booklet_id && !formData.receipt_no) {
            newErrors.receipt_no = 'Receipt number is required';
        }

        // Date validation
        if (!formData.tx_date) {
            newErrors.tx_date = 'Transaction date is required';
        } else if (selectedAccount && selectedAccount.last_closed_date) {
            // Check if transaction date is in a closed period
            const txDate = new Date(formData.tx_date);
            const lastClosedDate = new Date(selectedAccount.last_closed_date);

            // Set both dates to start of day for accurate comparison
            txDate.setHours(0, 0, 0, 0);
            lastClosedDate.setHours(0, 0, 0, 0);

            if (txDate <= lastClosedDate) {
                newErrors.tx_date = `This date falls in a closed accounting period. Periods up to ${new Date(selectedAccount.last_closed_date).toLocaleDateString()} are locked.`;
            }
        }

        console.log('Form validation results:', { hasErrors: Object.keys(newErrors).length > 0, errors: newErrors });
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

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        // Check for closed period that might need admin override
        if (formData.tx_date && selectedAccount && selectedAccount.last_closed_date) {
            const txDate = new Date(formData.tx_date);
            const closedDate = new Date(selectedAccount.last_closed_date);

            if (txDate <= closedDate && isAdmin) {
                // Show admin override confirmation modal
                setShowAdminOverrideModal(true);
                return;
            }
        }

        // Normal submission process continues
        submitTransaction();
    };

    // Add a function to handle admin override confirmation
    const handleAdminOverride = async () => {
        setShowAdminOverrideModal(false);
        // Add admin override flag to the form data
        await submitTransaction(true);
    };

    // Modify the submitTransaction function to accept the override parameter
    const submitTransaction = async (adminOverride = false) => {
        setSubmitting(true);

        try {
            let dataToSubmit = { ...formData };

            if (adminOverride) {
                dataToSubmit.admin_override = true;
            }

            console.log('Submitting form data:', dataToSubmit);

            // Add more detailed logging just before submitting data
            console.log('Submitting form data with cash_type:', {
                cashType: dataToSubmit.cash_type,
                validValues: ['cash', 'bank', 'upi', 'card', 'netbank', 'cheque', 'multiple'],
                isValid: ['cash', 'bank', 'upi', 'card', 'netbank', 'cheque', 'multiple'].includes(dataToSubmit.cash_type)
            });

            // Prepare data for API
            const submitData = {
                account_id: parseInt(dataToSubmit.account_id),
                ledger_head_id: parseInt(dataToSubmit.ledger_head_id),
                donor_id: dataToSubmit.donor_id ? parseInt(dataToSubmit.donor_id) : null,
                booklet_id: dataToSubmit.booklet_id ? parseInt(dataToSubmit.booklet_id) : null,
                receipt_no: dataToSubmit.receipt_no ? parseInt(dataToSubmit.receipt_no) : null,
                amount: parseFloat(dataToSubmit.amount),
                cash_type: dataToSubmit.cash_type === 'both' ? 'multiple' : dataToSubmit.cash_type, // Ensure 'both' is never sent to backend
                tx_date: dataToSubmit.tx_date,
                description: dataToSubmit.description
            };

            // Add cash_amount and bank_amount for multiple payment types
            if (dataToSubmit.cash_type === 'multiple') {
                submitData.cash_amount = parseFloat(dataToSubmit.cash_amount || 0);
                submitData.bank_amount = parseFloat(dataToSubmit.bank_amount || 0);
            }

            // Add split transactions if present
            if (dataToSubmit.splits && dataToSubmit.splits.length > 0) {
                submitData.splits = dataToSubmit.splits.map(split => ({
                    ledger_head_id: parseInt(split.ledger_head_id),
                    amount: parseFloat(split.amount)
                }));
            }

            console.log('Prepared data for submission:', submitData);

            let response;

            if (isEditing) {
                // Update existing transaction
                console.log(`Updating transaction ${dataToSubmit.id}...`);
                response = await api.put(`${API_CONFIG.API_PREFIX}/transactions/${dataToSubmit.id}`, submitData);
                console.log('Update response:', response.data);
                toast.success('Transaction updated successfully', {
                    position: "top-right",
                    autoClose: 3000
                });
            } else {
                // Create new transaction
                console.log('Creating new transaction...');
                response = await api.post(`${API_CONFIG.API_PREFIX}/transactions/credit`, submitData);
                console.log('Creation response:', response.data);
                toast.success('Transaction created successfully', {
                    position: "top-right",
                    autoClose: 3000
                });
            }

            // Check for successful response
            if (response.data && response.data.success) {
                if (onSuccess) {
                    onSuccess(response.data.transaction || response.data.data);
                }
            } else {
                console.warn('Unexpected API response format:', response.data);
                setError('Unexpected response from server');
            }
        } catch (err) {
            console.error('Error submitting transaction:', err);

            let errorMessage = 'Failed to save transaction';

            if (err.response) {
                console.error('Response data:', err.response.data);
                errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;

                // Special handling for booklet errors
                if (errorMessage.includes('booklet') || errorMessage.includes('receipt')) {
                    // Reload booklets in case they've changed
                    try {
                        const bookletsRes = await api.get(`${API_CONFIG.API_PREFIX}/booklets`, {
                            params: { is_active: true }
                        });
                        setBooklets(bookletsRes.data?.data || []);
                    } catch (refreshErr) {
                        console.error('Error refreshing booklets:', refreshErr);
                    }
                }
            } else if (err.request) {
                errorMessage = 'No response from server. Please check your connection.';
            }

            setError(errorMessage);
            toast.error(errorMessage, {
                position: "top-right",
                autoClose: 5000
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Render receipt grid with beautiful styling
    const renderReceiptGrid = () => {
        console.log('Rendering receipt grid:', {
            bookletId: formData.booklet_id,
            selectedReceipt: formData.receipt_no,
            availableReceipts: availableReceiptNumbers.length
        });

        if (!formData.booklet_id) {
            return (
                <div className="p-4 text-center bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
                    Select a booklet first
                </div>
            );
        }

        if (availableReceiptNumbers.length === 0) {
            return (
                <div className="p-4 text-center bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
                    No receipts available
                </div>
            );
        }

        // Simplified receipt grid with clearer display
        return (
            <div className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-3.5 py-2.5 border-b border-gray-100 bg-blue-50">
                    <h4 className="text-sm font-medium text-gray-700">Available Receipt Numbers</h4>
                    <span className="text-xs bg-white px-2.5 py-1 rounded-full border border-gray-200 text-blue-600 font-medium">
                        {availableReceiptNumbers.length} remaining
                    </span>
                </div>

                <div className="p-3">
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[250px] overflow-y-auto">
                        {availableReceiptNumbers.map(num => (
                            <button
                                key={num}
                                type="button"
                                className={`py-2.5 text-center rounded-lg text-base transition-all duration-150 ${formData.receipt_no === num
                                    ? 'bg-blue-500 text-white font-medium shadow-sm hover:bg-blue-600'
                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-blue-300'
                                    }`}
                                onClick={() => {
                                    console.log('Selected receipt number:', num);
                                    setFormData(prev => ({
                                        ...prev,
                                        receipt_no: num
                                    }));

                                    // Clear validation error if exists
                                    if (errors.receipt_no) {
                                        setErrors(prev => ({
                                            ...prev,
                                            receipt_no: null
                                        }));
                                    }
                                }}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>

                {formData.receipt_no && (
                    <div className="px-3 py-2 bg-blue-50 border-t border-blue-100 text-center">
                        <span className="font-medium text-blue-700">Selected: </span>
                        <span className="text-blue-900 font-bold">#{formData.receipt_no}</span>
                    </div>
                )}
            </div>
        );
    };

    // Render booklet selection with beautiful styling
    const renderBookletSelection = () => {
        return (
            <div className="space-y-2">
                {/* Booklet Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Booklet <span className="text-red-500">*</span>
                    </label>
                    <div className="relative mb-3 group">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                            <FaSearch className="w-4 h-4 group-hover:text-indigo-500 transition-colors duration-200" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search booklets by number or range..."
                            value={bookletSearchQuery}
                            onChange={(e) => setBookletSearchQuery(e.target.value)}
                            className="pl-10 w-full bg-white border-2 border-indigo-100 focus:border-indigo-300 rounded-lg px-4 py-3 text-gray-700 focus:ring-2 focus:ring-indigo-200 shadow-sm transition-all duration-200"
                            disabled={submitting}
                        />
                    </div>
                </div>

                {/* Booklet List with enhanced styling */}
                <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden max-h-[220px] overflow-y-auto">
                    {filteredBooklets.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                            No booklets found
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredBooklets.map(booklet => (
                                <div
                                    key={booklet.id}
                                    className={`p-4 cursor-pointer hover:bg-gray-100 border-l-4 transition-all duration-200 ${formData.booklet_id === booklet.id ? 'border-l-indigo-500 bg-indigo-50' : 'border-l-transparent'}`}
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            booklet_id: booklet.id,
                                            receipt_no: ''
                                        }));

                                        // Immediately select the first receipt number without timeout
                                        const receipts = getAvailableReceiptNumbers(booklet);
                                        if (receipts.length > 0) {
                                            setFormData(prev => ({
                                                ...prev,
                                                booklet_id: booklet.id,
                                                receipt_no: receipts[0]
                                            }));
                                        }

                                        if (errors.booklet_id) {
                                            setErrors(prev => ({
                                                ...prev,
                                                booklet_id: null
                                            }));
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-gray-800 text-base">#{booklet.booklet_no}</span>
                                        <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
                                            {booklet.pages_left ? booklet.pages_left.length : 0} receipts
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-500 mt-2">
                                        Range: {booklet.start_no}-{booklet.end_no}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {errors.booklet_id && (
                    <p className="mt-1.5 text-sm text-red-600 error-message">{errors.booklet_id}</p>
                )}
            </div>
        );
    };

    // Update the account selection handler in the form component
    const handleAccountChange = (accountId) => {
        // Find the selected account object
        const account = accounts.find(acc => acc.id === parseInt(accountId));
        setSelectedAccount(account);

        // Update form data
        setFormData({
            ...formData,
            account_id: accountId
        });

        // Close the dropdown
        setIsAccountDropdownOpen(false);
    };

    // Admin override modal
    const renderAdminOverrideModal = () => {
        return (
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${showAdminOverrideModal ? 'visible' : 'invisible'}`}>
                {/* Modal backdrop */}
                {showAdminOverrideModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowAdminOverrideModal(false)}></div>
                )}

                {/* Modal content */}
                <div className={`relative bg-white rounded-lg shadow-xl transform transition-all max-w-lg w-full p-6 ${showAdminOverrideModal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                    <div className="flex items-center justify-between border-b pb-3">
                        <h3 className="text-xl font-medium text-gray-900 flex items-center">
                            <FaExclamationTriangle className="text-yellow-500 mr-2" />
                            Closed Period Override
                        </h3>
                        <button
                            onClick={() => setShowAdminOverrideModal(false)}
                            className="text-gray-400 hover:text-gray-500"
                        >
                            <FaTimes />
                        </button>
                    </div>

                    <div className="py-4">
                        <p className="text-sm text-gray-500 mb-4">
                            You are creating a transaction dated <strong>{formatDate(formData.tx_date)}</strong>, which falls in a closed period.
                            The account <strong>{selectedAccount?.name}</strong> has been closed through <strong>{formatDate(selectedAccount?.last_closed_date)}</strong>.
                        </p>

                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                            <div className="flex items-start">
                                <FaExclamationTriangle className="text-yellow-500 mr-3 mt-0.5" />
                                <div>
                                    <p className="font-medium text-sm text-yellow-700">Warning</p>
                                    <p className="text-sm text-yellow-600">
                                        Creating backdated transactions in closed periods will automatically recalculate all monthly snapshots
                                        from this date forward. This may affect reports and financial statements that have already been generated.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <p className="font-medium text-gray-700 mb-2">Are you sure you want to proceed?</p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-3 border-t">
                        <button
                            onClick={() => setShowAdminOverrideModal(false)}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdminOverride}
                            className="px-4 py-2 bg-yellow-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-yellow-700"
                        >
                            Override and Create
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Set min date for the date picker - 1 day after the last closed date
    const getMinDate = () => {
        if (selectedAccount && selectedAccount.last_closed_date) {
            const lastClosed = new Date(selectedAccount.last_closed_date);
            lastClosed.setDate(lastClosed.getDate() + 1); // One day after last closed date
            return lastClosed.toISOString().split('T')[0];
        }
        return null;
    };

    // Add the closed period notice in the form
    const renderClosedPeriodNotice = () => {
        if (selectedAccount && selectedAccount.last_closed_date) {
            return (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
                    <div className="flex items-center">
                        <FaLock className="text-blue-500 mr-2" />
                        <p className="text-sm text-blue-700">
                            Note: Periods up to {formatDate(selectedAccount.last_closed_date)} are closed
                            {isAdmin && ' (admin override available)'}
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Render form UI
    return (
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <FaRegCreditCard className="mr-2 text-blue-500" />
                    {isEditing ? 'Edit Credit Transaction' : 'New Credit Transaction'}
                </h2>
                <p className="text-gray-500 mt-1 text-sm">
                    {isEditing
                        ? 'Edit the details of an existing credit transaction'
                        : 'Create a new credit transaction by filling out the form below'
                    }
                </p>
            </div>

            {/* Alert for errors */}
            {error && (
                <div className="mb-6 px-4 py-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <FaExclamationTriangle className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading state with improved spinner */}
            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <div className="relative">
                        <div className="h-8 w-8 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin"></div>
                        <div className="h-8 w-8 rounded-full border-r-2 border-l-2 border-blue-300 animate-spin absolute top-0 left-0" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                    </div>
                    <span className="ml-3 text-blue-600 font-medium text-sm">Loading...</span>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="px-4 py-4">
                    {/* Main information section with improved card styling */}
                    <div className="mb-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-lg p-3 border border-blue-100/50 shadow-sm">
                        <h3 className="text-xs uppercase tracking-wider text-blue-700 font-semibold mb-2 flex items-center">
                            <FaLayerGroup className="mr-1.5 text-xs" />
                            Transaction Details
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Account Selection with enhanced styling */}
                            <div className="bg-white p-2 rounded-lg border border-gray-200/80 shadow-sm">
                                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                    <FaMoneyBillWave className="text-blue-500 mr-1 text-xs" />
                                    Account <span className="text-red-500 ml-0.5">*</span>
                                </label>
                                <div className="relative" ref={accountDropdownRef}>
                                    <div
                                        className="w-full bg-white border border-gray-200 hover:border-blue-400 rounded-md px-2.5 py-1.5 text-sm text-gray-700 cursor-pointer flex justify-between items-center shadow-sm transition-all duration-200 hover:shadow"
                                        onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                                    >
                                        <span className="font-medium truncate text-xs">
                                            {formData.account_id
                                                ? (accounts.find(a => a.id.toString() === formData.account_id.toString())?.name || 'Select Account')
                                                : 'Select Account'}
                                        </span>
                                        <svg className={`fill-current h-3 w-3 text-gray-400 transition-transform duration-200 ${isAccountDropdownOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                        </svg>
                                    </div>
                                    {isAccountDropdownOpen && (
                                        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-100 rounded-md shadow-lg">
                                            <div className="p-1.5 border-b border-gray-100">
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                                        <FaSearch className="h-3 w-3 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Search accounts..."
                                                        value={accountSearchQuery}
                                                        onChange={(e) => setAccountSearchQuery(e.target.value)}
                                                        className="w-full bg-gray-50 border border-gray-100 rounded text-xs pl-6 pr-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-32 overflow-y-auto py-1">
                                                {filteredAccounts.length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-gray-500">No accounts found</div>
                                                ) : (
                                                    filteredAccounts.map(account => (
                                                        <div
                                                            key={account.id}
                                                            className={`px-3 py-1.5 text-xs cursor-pointer transition-colors duration-150 ${formData.account_id === account.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Get credit type ledger heads for the selected account
                                                                const accountCreditLedgerHeads = ledgerHeads.filter(
                                                                    head => head && head.account_id === account.id && head.head_type === 'credit'
                                                                );
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    account_id: account.id,
                                                                    ledger_head_id: accountCreditLedgerHeads.length > 0 ? accountCreditLedgerHeads[0].id : ''
                                                                }));
                                                                setAccountSearchQuery('');
                                                                setIsAccountDropdownOpen(false);
                                                            }}
                                                        >
                                                            {account.name}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {errors.account_id && (
                                    <p className="mt-1 text-xs text-red-600 error-message">{errors.account_id}</p>
                                )}
                            </div>

                            {/* Ledger Head Selection with enhanced styling */}
                            <div className="bg-white p-2 rounded-lg border border-gray-200/80 shadow-sm">
                                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                    <FaLayerGroup className="text-blue-500 mr-1 text-xs" />
                                    Ledger Head <span className="text-red-500 ml-0.5">*</span>
                                </label>
                                <div className="relative" ref={ledgerDropdownRef}>
                                    <div
                                        className={`w-full bg-white border border-gray-200 hover:border-blue-400 rounded-md px-2.5 py-1.5 text-sm text-gray-700 flex justify-between items-center shadow-sm transition-all duration-200 hover:shadow ${!formData.account_id ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                        onClick={() => formData.account_id && setIsLedgerDropdownOpen(!isLedgerDropdownOpen)}
                                    >
                                        <span className="font-medium truncate text-xs">
                                            {formData.ledger_head_id
                                                ? (ledgerHeads.find(h => h.id.toString() === formData.ledger_head_id.toString())?.name || 'Select Ledger Head')
                                                : 'Select Ledger Head'}
                                        </span>
                                        <svg className={`fill-current h-3 w-3 text-gray-400 transition-transform duration-200 ${isLedgerDropdownOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                        </svg>
                                    </div>
                                    {isLedgerDropdownOpen && (
                                        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-100 rounded-md shadow-lg">
                                            <div className="p-1.5 border-b border-gray-100">
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                                        <FaSearch className="h-3 w-3 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Search ledger heads..."
                                                        value={ledgerHeadSearchQuery}
                                                        onChange={(e) => setLedgerHeadSearchQuery(e.target.value)}
                                                        className="w-full bg-gray-50 border border-gray-100 rounded text-xs pl-6 pr-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-32 overflow-y-auto py-1">
                                                {filteredLedgerHeads.length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-gray-500">No ledger heads found</div>
                                                ) : (
                                                    filteredLedgerHeads.map(head => (
                                                        <div
                                                            key={head.id}
                                                            className={`px-3 py-1.5 text-xs cursor-pointer transition-colors duration-150 ${formData.ledger_head_id === head.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    ledger_head_id: head.id
                                                                }));
                                                                setLedgerHeadSearchQuery('');
                                                                setIsLedgerDropdownOpen(false);
                                                            }}
                                                        >
                                                            {head.name}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {errors.ledger_head_id && (
                                    <p className="mt-1 text-xs text-red-600 error-message">{errors.ledger_head_id}</p>
                                )}
                            </div>

                            {/* Display Balance Banner when ledger head is selected */}
                            {formData.ledger_head_id && (
                                <div className="mt-3 mb-3">
                                    <BalanceBanner ledgerId={formData.ledger_head_id} />
                                </div>
                            )}

                            {/* Donor Selection with enhanced styling */}
                            <div className="bg-white p-2 rounded-lg border border-gray-200/80 shadow-sm">
                                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                    <FaUser className="text-blue-500 mr-1 text-xs" />
                                    Donor (Optional)
                                </label>
                                <div className="relative" ref={donorDropdownRef}>
                                    <div
                                        className="w-full bg-white border border-gray-200 hover:border-blue-400 rounded-md px-2.5 py-1.5 text-sm text-gray-700 cursor-pointer flex justify-between items-center shadow-sm transition-all duration-200 hover:shadow"
                                        onClick={() => setIsDonorDropdownOpen(!isDonorDropdownOpen)}
                                    >
                                        <span className="font-medium truncate text-xs">
                                            {formData.donor_id
                                                ? (donors.find(d => d.id.toString() === formData.donor_id.toString())?.name || 'Select Donor')
                                                : 'Select Donor'}
                                        </span>
                                        <svg className={`fill-current h-3 w-3 text-gray-400 transition-transform duration-200 ${isDonorDropdownOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                        </svg>
                                    </div>

                                    {isDonorDropdownOpen && (
                                        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-100 rounded-md shadow-lg">
                                            <div className="p-1.5 border-b border-gray-100">
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                                        <FaSearch className="h-3 w-3 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Search..."
                                                        value={donorSearchQuery}
                                                        onChange={(e) => setDonorSearchQuery(e.target.value)}
                                                        className="w-full bg-gray-50 border border-gray-100 rounded text-xs pl-6 pr-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-32 overflow-y-auto py-1">
                                                {filteredDonors.length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-gray-500">No donors found</div>
                                                ) : (
                                                    filteredDonors.map(donor => (
                                                        <div
                                                            key={donor.id}
                                                            className={`px-3 py-1.5 text-xs cursor-pointer transition-colors duration-150 ${formData.donor_id === donor.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    donor_id: donor.id
                                                                }));
                                                                setDonorSearchQuery('');
                                                                setIsDonorDropdownOpen(false);
                                                            }}
                                                        >
                                                            {donor.name}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MOVED: Amount Section - Now positioned prominently at the top */}
                    <div className="mb-4 bg-white rounded-lg overflow-hidden border border-green-200 shadow-sm">
                        <div className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 flex items-center">
                            <FaRupeeSign className="text-white mr-1.5 text-sm" />
                            <h3 className="text-sm font-semibold text-white">Amount Details</h3>
                        </div>

                        <div className="p-3 space-y-3">
                            {/* Transaction Date and Payment Method in a row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                {/* Transaction Date with fancy animation */}
                                <div className="bg-white p-2 rounded-md border border-gray-200/80 shadow-sm">
                                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                        <FaCalendarAlt className="text-green-500 mr-1 text-xs" />
                                        Date <span className="text-red-500 ml-0.5">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                                            <FaCalendarAlt className="w-3 h-3 group-hover:text-green-500 transition-colors duration-200" />
                                        </div>
                                        <input
                                            type="date"
                                            name="tx_date"
                                            value={formData.tx_date}
                                            onChange={handleInputChange}
                                            className="pl-7 w-full bg-white border border-gray-200 focus:border-green-400 rounded px-2 py-1.5 text-xs text-gray-700 focus:ring-1 focus:ring-green-400 shadow-sm transition-all duration-200 hover:shadow"
                                            disabled={submitting}
                                            min={getMinDate()}
                                        />
                                    </div>
                                    {errors.tx_date && (
                                        <p className="mt-1 text-xs text-red-600">{errors.tx_date}</p>
                                    )}
                                </div>

                                {/* Payment Type with improved visual cues */}
                                <div className="md:col-span-3 bg-white p-2 rounded-md border border-gray-200/80 shadow-sm">
                                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                        <FaMoneyBillWave className="text-green-500 mr-1 text-xs" />
                                        Payment Method <span className="text-red-500 ml-0.5">*</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <label className={`flex items-center py-1.5 px-3 rounded border transition-all duration-200 cursor-pointer ${formData.cash_type === 'cash' ? 'border-green-400 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'}`}>
                                            <input
                                                type="radio"
                                                name="cash_type"
                                                value="cash"
                                                checked={formData.cash_type === 'cash'}
                                                onChange={handleInputChange}
                                                className="mr-1.5 h-3 w-3 text-green-500 border-gray-300 focus:ring-green-500"
                                                disabled={submitting}
                                            />
                                            <span className="text-xs font-medium">Cash</span>
                                            <FaMoneyBillWave className={`ml-1.5 text-xs ${formData.cash_type === 'cash' ? 'text-green-500' : 'text-gray-400'}`} />
                                        </label>

                                        <label className={`flex items-center py-1.5 px-3 rounded border transition-all duration-200 cursor-pointer ${formData.cash_type === 'bank' ? 'border-green-400 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'}`}>
                                            <input
                                                type="radio"
                                                name="cash_type"
                                                value="bank"
                                                checked={formData.cash_type === 'bank'}
                                                onChange={handleInputChange}
                                                className="mr-1.5 h-3 w-3 text-green-500 border-gray-300 focus:ring-green-500"
                                                disabled={submitting}
                                            />
                                            <span className="text-xs font-medium">Bank</span>
                                            <FaUniversity className={`ml-1.5 text-xs ${formData.cash_type === 'bank' ? 'text-green-500' : 'text-gray-400'}`} />
                                        </label>

                                        <label className={`flex items-center py-1.5 px-3 rounded border transition-all duration-200 cursor-pointer ${formData.cash_type === 'multiple' ? 'border-green-400 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'}`}>
                                            <input
                                                type="radio"
                                                name="cash_type"
                                                value="multiple"
                                                checked={formData.cash_type === 'multiple'}
                                                onChange={handleInputChange}
                                                className="mr-1.5 h-3 w-3 text-green-500 border-gray-300 focus:ring-green-500"
                                                disabled={submitting}
                                            />
                                            <span className="text-xs font-medium">Both</span>
                                            <div className="flex ml-1.5">
                                                <FaMoneyBillWave className={`text-xs ${formData.cash_type === 'multiple' ? 'text-green-500' : 'text-gray-400'} mr-0.5`} />
                                                <FaUniversity className={`text-xs ${formData.cash_type === 'multiple' ? 'text-green-500' : 'text-gray-400'}`} />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Amount Inputs */}
                            {formData.cash_type === 'multiple' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                    {/* Cash Amount */}
                                    <div className="bg-white p-2.5 rounded-md border border-green-100 shadow-sm transition-all duration-200 hover:shadow-md">
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center">
                                            <FaMoneyBillWave className="text-green-500 mr-1.5 text-xs" />
                                            Cash Income Amount <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative group bg-white shadow-inner rounded overflow-hidden border-2 border-green-100 focus-within:border-green-400 transition-all duration-200">
                                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                                <FaRupeeSign className="text-green-500 w-3.5 h-3.5" />
                                            </div>
                                            <input
                                                type="number"
                                                name="cash_amount"
                                                value={formData.cash_amount || ''}
                                                onChange={handleInputChange}
                                                placeholder="Cash amount"
                                                className="pl-8 w-full bg-transparent border-none py-2 text-sm text-gray-700 focus:ring-0 font-medium"
                                                min="0"
                                                disabled={submitting}
                                            />
                                        </div>
                                        {errors.cash_amount && (
                                            <div className="mt-1.5 py-1.5 px-2 bg-red-50 border-l-3 border-red-500 rounded text-xs text-red-600 error-message">
                                                {errors.cash_amount}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bank Amount */}
                                    <div className="bg-white p-2.5 rounded-md border border-green-100 shadow-sm transition-all duration-200 hover:shadow-md">
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center">
                                            <FaUniversity className="text-green-500 mr-1.5 text-xs" />
                                            Bank Income Amount <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative group bg-white shadow-inner rounded overflow-hidden border-2 border-green-100 focus-within:border-green-400 transition-all duration-200">
                                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                                <FaRupeeSign className="text-green-500 w-3.5 h-3.5" />
                                            </div>
                                            <input
                                                type="number"
                                                name="bank_amount"
                                                value={formData.bank_amount || ''}
                                                onChange={handleInputChange}
                                                placeholder="Bank amount"
                                                className="pl-8 w-full bg-transparent border-none py-2 text-sm text-gray-700 focus:ring-0 font-medium"
                                                min="0"
                                                disabled={submitting}
                                            />
                                        </div>
                                        {errors.bank_amount && (
                                            <div className="mt-1.5 py-1.5 px-2 bg-red-50 border-l-3 border-red-500 rounded text-xs text-red-600 error-message">
                                                {errors.bank_amount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Single Amount for 'cash' or 'bank' */
                                <div className="bg-white p-2.5 rounded-md border border-green-100 shadow-sm transition-all duration-200 hover:shadow-md">
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center">
                                        {formData.cash_type === 'cash' ? (
                                            <FaMoneyBillWave className="text-green-500 mr-1.5 text-xs" />
                                        ) : (
                                            <FaUniversity className="text-green-500 mr-1.5 text-xs" />
                                        )}
                                        {formData.cash_type === 'cash' ? 'Cash' : 'Bank'} Income Amount <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative group bg-white shadow-inner rounded overflow-hidden border-2 border-green-100 focus-within:border-green-400 transition-all duration-200">
                                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                            <FaRupeeSign className="text-green-500 w-3.5 h-3.5" />
                                        </div>
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount || ''}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                            className="pl-8 w-full bg-transparent border-none py-2 text-sm text-gray-700 focus:ring-0 font-medium"
                                            min="0"
                                            disabled={submitting}
                                        />
                                    </div>
                                    {errors.amount && (
                                        <div className="mt-1.5 py-1.5 px-2 bg-red-50 border-l-3 border-red-500 rounded text-xs text-red-600 error-message">
                                            {errors.amount}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Total Amount Display - Enhanced for both payment method */}
                            {formData.cash_type === 'multiple' && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded p-2 border border-green-200 shadow-sm mt-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-gray-700 flex items-center">
                                            <FaRupeeSign className="text-green-500 mr-1.5 text-xs" />
                                            Total Income Amount
                                        </span>
                                        <span className="text-sm font-bold text-green-600">
                                            ₹{parseFloat(formData.amount || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div className="mt-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                    Description (Optional)
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={2}
                                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-700 focus:ring-1 focus:ring-green-400 focus:border-green-400 shadow-sm transition-all duration-200 hover:shadow resize-none"
                                    placeholder="Any additional notes..."
                                    disabled={submitting}
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Receipt Information Card */}
                    <div className="mb-4 bg-white rounded-lg overflow-hidden border border-gray-200/80 shadow-sm">
                        <div className="px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center">
                            <FaReceipt className="text-white mr-1.5 text-xs" />
                            <h3 className="text-sm font-medium text-white">Receipt Information</h3>
                        </div>

                        <div className="p-3 space-y-3">
                            {/* Booklet Selection - Simplified to match the design */}
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                    <FaBook className="text-indigo-500 mr-1 text-xs" />
                                    Booklet <span className="text-red-500 ml-0.5">*</span>
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                                        <FaSearch className="w-3 h-3 group-hover:text-indigo-500 transition-colors duration-200" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search booklets by number or range..."
                                        value={bookletSearchQuery}
                                        onChange={(e) => setBookletSearchQuery(e.target.value)}
                                        className="pl-7 w-full bg-white border border-indigo-100 focus:border-indigo-300 rounded px-2.5 py-1.5 text-xs text-gray-700 focus:ring-1 focus:ring-indigo-200 shadow-sm transition-all duration-200"
                                        disabled={submitting}
                                    />
                                </div>

                                {/* Booklet List with simplified styling */}
                                <div className="bg-gray-50 rounded border border-gray-100 overflow-hidden max-h-[150px] overflow-y-auto">
                                    {filteredBooklets.length === 0 ? (
                                        <div className="p-2 text-center text-xs text-gray-500">
                                            No booklets found
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {filteredBooklets.map(booklet => (
                                                <div
                                                    key={booklet.id}
                                                    className={`p-2 cursor-pointer hover:bg-gray-100 border-l-3 transition-all duration-200 ${formData.booklet_id === booklet.id ? 'border-l-indigo-500 bg-indigo-50' : 'border-l-transparent'}`}
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            booklet_id: booklet.id,
                                                            receipt_no: ''
                                                        }));

                                                        // Immediately select the first receipt number
                                                        const receipts = getAvailableReceiptNumbers(booklet);
                                                        if (receipts.length > 0) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                booklet_id: booklet.id,
                                                                receipt_no: receipts[0]
                                                            }));
                                                        }

                                                        if (errors.booklet_id) {
                                                            setErrors(prev => ({
                                                                ...prev,
                                                                booklet_id: null
                                                            }));
                                                        }
                                                    }}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-semibold text-gray-800 text-xs">#{booklet.booklet_no}</span>
                                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                                            {booklet.pages_left ? booklet.pages_left.length : 0} receipts
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Range: {booklet.start_no}-{booklet.end_no}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {errors.booklet_id && (
                                    <p className="mt-1 text-xs text-red-600 error-message">{errors.booklet_id}</p>
                                )}
                            </div>

                            {/* Receipt Number Grid - Compact version */}
                            <div className="mt-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                                    <FaReceipt className="text-indigo-500 mr-1 text-xs" />
                                    Receipt Number <span className="text-red-500 ml-0.5">*</span>
                                </label>

                                {!formData.booklet_id ? (
                                    <div className="p-2 text-center bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                                        Select a booklet first
                                    </div>
                                ) : availableReceiptNumbers.length === 0 ? (
                                    <div className="p-2 text-center bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                                        No receipts available
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-100 rounded overflow-hidden shadow-sm">
                                        <div className="flex justify-between items-center px-2.5 py-1.5 border-b border-gray-100 bg-blue-50">
                                            <h4 className="text-xs font-medium text-gray-700">Available Receipt Numbers</h4>
                                            <span className="text-xs bg-white px-1.5 py-0.5 rounded-full border border-gray-200 text-blue-600 font-medium">
                                                {availableReceiptNumbers.length} remaining
                                            </span>
                                        </div>

                                        <div className="p-2">
                                            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-1 max-h-[150px] overflow-y-auto">
                                                {availableReceiptNumbers.map(num => (
                                                    <button
                                                        key={num}
                                                        type="button"
                                                        className={`py-1 text-center rounded text-xs transition-all duration-150 ${formData.receipt_no === num
                                                            ? 'bg-blue-500 text-white font-medium shadow-sm hover:bg-blue-600'
                                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-blue-300'
                                                            }`}
                                                        onClick={() => {
                                                            console.log('Selected receipt number:', num);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                receipt_no: num
                                                            }));

                                                            // Clear validation error if exists
                                                            if (errors.receipt_no) {
                                                                setErrors(prev => ({
                                                                    ...prev,
                                                                    receipt_no: null
                                                                }));
                                                            }
                                                        }}
                                                    >
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {formData.receipt_no && (
                                            <div className="px-2.5 py-1.5 bg-blue-50 border-t border-blue-100 text-center">
                                                <span className="font-medium text-blue-700 text-xs">Selected: </span>
                                                <span className="text-blue-900 font-bold text-xs">#{formData.receipt_no}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {errors.receipt_no && (
                                    <p className="mt-1 text-xs text-red-600 error-message">{errors.receipt_no}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Submit and cancel buttons */}
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors flex items-center"
                            disabled={submitting}
                        >
                            <FaTimes className="mr-1.5" />
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center"
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

            {selectedAccount && selectedAccount.last_closed_date && (
                <p className="mt-1 text-xs text-amber-600">
                    Note: Periods up to {new Date(selectedAccount.last_closed_date).toLocaleDateString()} are closed.
                </p>
            )}

            {showAdminOverrideModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
                    <div className="bg-white p-5 rounded-lg shadow-lg max-w-md w-full">
                        <h3 className="text-lg font-medium text-red-600 mb-3">Admin Override Required</h3>
                        <p className="text-gray-700 mb-4">
                            You are creating a transaction dated {formData.tx_date}, which falls in a closed accounting period.
                            This will require recalculation of monthly balances. Are you sure you want to proceed?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
                                onClick={() => setShowAdminOverrideModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                                onClick={handleAdminOverride}
                            >
                                Confirm Override
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {renderAdminOverrideModal()}
        </div>
    );
} 