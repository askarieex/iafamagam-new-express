import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaPlus, FaEdit, FaTrash, FaSync, FaFilter, FaSearch, FaChevronDown, FaChevronUp,
    FaMoneyBillWave, FaUniversity, FaCreditCard, FaReceipt, FaLink, FaTags,
    FaExchangeAlt, FaBalanceScale, FaInfoCircle, FaEye, FaDownload, FaUpload,
    FaMosque, FaHeart, FaDollarSign, FaBriefcase, FaChartLine, FaUsers,
    FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaGift
} from 'react-icons/fa';
import API_CONFIG from '../config';
import { toast } from 'react-hot-toast';

export default function ManageLedgerEnhanced() {
    // State management
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [dependencies, setDependencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedAccount, setSelectedAccount] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingHead, setEditingHead] = useState(null);
    const [showDependencyModal, setShowDependencyModal] = useState(false);
    const [selectedHead, setSelectedHead] = useState(null);

    // Form data for add/edit
    const [formData, setFormData] = useState({
        account_id: '',
        name: '',
        head_type: 'credit',
        dependency_type: 'independent',
        islamic_category: 'General',
        current_balance: 0,
        cash_balance: 0,
        bank_balance: 0,
        description: '',
        is_restricted: false,
        spending_rules: '',
        sort_order: 0,
        create_linked_head: false,
        linked_debit_head: ''
    });

    // Islamic categories
    const islamicCategories = {
        credit: [
            { value: 'General Donation', label: 'General Donation (عام چندہ)', icon: FaGift },
            { value: 'Sahm-e-Imam', label: 'Sahm-e-Imam (سہم امام)', icon: FaMosque },
            { value: 'Sahm-e-Sadat', label: 'Sahm-e-Sadat (سہم سادات)', icon: FaUsers },
            { value: 'Zakat', label: 'Zakat (زکوٰۃ)', icon: FaHeart },
            { value: 'Fees', label: 'Fees (فیس)', icon: FaBriefcase },
            { value: 'General', label: 'General (عام)', icon: FaDollarSign }
        ],
        debit: [
            { value: 'Expense', label: 'General Expense (عام اخراجات)', icon: FaReceipt },
            { value: 'Salaries', label: 'Salaries (تنخواہیں)', icon: FaUsers },
            { value: 'Utilities', label: 'Utilities (یوٹیلٹیز)', icon: FaChartLine },
            { value: 'Religious', label: 'Religious (مذہبی)', icon: FaMosque },
            { value: 'Education', label: 'Education (تعلیم)', icon: FaBriefcase }
        ]
    };

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
    });

    // Fetch all data
    useEffect(() => {
        Promise.all([
            fetchLedgerHeads(),
            fetchAccounts(),
            fetchDependencies()
        ]);
    }, []);

    const fetchLedgerHeads = async () => {
        try {
            setLoading(true);
            const url = selectedAccount 
                ? `/api/ledger-heads?account_id=${selectedAccount}` 
                : '/api/ledger-heads';
            const response = await api.get(url);
            
            if (response.data?.success) {
                setLedgerHeads(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching ledger heads:', error);
            toast.error('Failed to fetch ledger heads');
        } finally {
            setLoading(false);
        }
    };

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

    const fetchDependencies = async () => {
        try {
            // This would be a new endpoint to fetch dependencies
            const response = await api.get('/api/ledger-heads/dependencies');
            if (response.data?.success) {
                setDependencies(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching dependencies:', error);
        }
    };

    // Filter and group ledger heads
    const getFilteredHeads = () => {
        let filtered = ledgerHeads.filter(head => {
            if (searchTerm && !head.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            if (filterType !== 'all' && head.head_type !== filterType) {
                return false;
            }
            return true;
        });

        return filtered.sort((a, b) => {
            // Sort by dependency_type first, then by sort_order, then by name
            if (a.dependency_type !== b.dependency_type) {
                const order = { 'independent': 1, 'dependent': 2, 'expense': 3 };
                return order[a.dependency_type] - order[b.dependency_type];
            }
            if (a.sort_order !== b.sort_order) {
                return a.sort_order - b.sort_order;
            }
            return a.name.localeCompare(b.name);
        });
    };

    const getCreditHeads = () => getFilteredHeads().filter(head => head.head_type === 'credit');
    const getDebitHeads = () => getFilteredHeads().filter(head => head.head_type === 'debit');

    // Get category icon
    const getCategoryIcon = (category, headType) => {
        const categories = islamicCategories[headType] || [];
        const cat = categories.find(c => c.value === category);
        return cat ? cat.icon : FaTags;
    };

    // Get category display name
    const getCategoryDisplay = (category, headType) => {
        const categories = islamicCategories[headType] || [];
        const cat = categories.find(c => c.value === category);
        return cat ? cat.label : category;
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingHead ? `/api/ledger-heads/${editingHead.id}` : '/api/ledger-heads';
            const method = editingHead ? 'PUT' : 'POST';

            const response = await api.request({
                method,
                url,
                data: formData
            });

            if (response.data?.success) {
                toast.success(`Ledger head ${editingHead ? 'updated' : 'created'} successfully`);
                setShowAddForm(false);
                setEditingHead(null);
                resetForm();
                fetchLedgerHeads();
            }
        } catch (error) {
            console.error('Error saving ledger head:', error);
            toast.error(error.response?.data?.message || 'Failed to save ledger head');
        }
    };

    const resetForm = () => {
        setFormData({
            account_id: accounts[0]?.id || '',
            name: '',
            head_type: 'credit',
            dependency_type: 'independent',
            islamic_category: 'General',
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0,
            description: '',
            is_restricted: false,
            spending_rules: '',
            sort_order: 0,
            create_linked_head: false,
            linked_debit_head: ''
        });
    };

    const handleEdit = (head) => {
        setFormData({ ...head });
        setEditingHead(head);
        setShowAddForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this ledger head?')) return;
        
        try {
            const response = await api.delete(`/api/ledger-heads/${id}`);
            if (response.data?.success) {
                toast.success('Ledger head deleted successfully');
                fetchLedgerHeads();
            }
        } catch (error) {
            console.error('Error deleting ledger head:', error);
            toast.error('Failed to delete ledger head');
        }
    };

    // Render summary cards
    const renderSummaryCards = () => {
        const creditHeads = getCreditHeads();
        const debitHeads = getDebitHeads();
        
        const independentFunds = creditHeads.filter(h => h.dependency_type === 'independent');
        const restrictedFunds = creditHeads.filter(h => h.dependency_type === 'dependent' || h.is_restricted);
        
        const totalCreditBalance = creditHeads.reduce((sum, h) => sum + parseFloat(h.current_balance || 0), 0);
        const totalDebitBalance = debitHeads.reduce((sum, h) => sum + parseFloat(h.current_balance || 0), 0);

        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm">Independent Funds</p>
                            <p className="text-2xl font-bold">{independentFunds.length}</p>
                            <p className="text-green-100 text-xs mt-1">
                                {formatCurrency(independentFunds.reduce((sum, h) => sum + parseFloat(h.current_balance || 0), 0))}
                            </p>
                        </div>
                        <FaBalanceScale className="text-3xl text-green-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-sm">Restricted Funds</p>
                            <p className="text-2xl font-bold">{restrictedFunds.length}</p>
                            <p className="text-orange-100 text-xs mt-1">
                                {formatCurrency(restrictedFunds.reduce((sum, h) => sum + parseFloat(h.current_balance || 0), 0))}
                            </p>
                        </div>
                        <FaExclamationTriangle className="text-3xl text-orange-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Total Credit Balance</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalCreditBalance)}</p>
                            <p className="text-blue-100 text-xs mt-1">{creditHeads.length} heads</p>
                        </div>
                        <FaCreditCard className="text-3xl text-blue-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-red-100 text-sm">Total Expense Heads</p>
                            <p className="text-2xl font-bold">{debitHeads.length}</p>
                            <p className="text-red-100 text-xs mt-1">{formatCurrency(totalDebitBalance)}</p>
                        </div>
                        <FaReceipt className="text-3xl text-red-200" />
                    </div>
                </div>
            </div>
        );
    };

    // Render balance sheet style layout
    const renderBalanceSheetView = () => {
        const creditHeads = getCreditHeads();
        const debitHeads = getDebitHeads();

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Credit Side */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center">
                                <FaCreditCard className="mr-3" />
                                Credit Heads (Income/Funds)
                            </h3>
                            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                                {creditHeads.length} heads
                            </span>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        {/* Independent Funds */}
                        <div className="mb-8">
                            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                <FaBalanceScale className="mr-2 text-green-600" />
                                Independent Funds
                                <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                    Can fund any expense
                                </span>
                            </h4>
                            {creditHeads.filter(h => h.dependency_type === 'independent').map(head => (
                                <div key={head.id} className="mb-3 p-4 border border-green-100 rounded-lg hover:border-green-300 transition-colors">
                                    {renderCreditHeadCard(head)}
                                </div>
                            ))}
                        </div>

                        {/* Restricted Funds */}
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                <FaExclamationTriangle className="mr-2 text-orange-600" />
                                Restricted Funds
                                <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                                    Limited usage
                                </span>
                            </h4>
                            {creditHeads.filter(h => h.dependency_type === 'dependent' || h.is_restricted).map(head => (
                                <div key={head.id} className="mb-3 p-4 border border-orange-100 rounded-lg hover:border-orange-300 transition-colors">
                                    {renderCreditHeadCard(head)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Debit Side */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center">
                                <FaReceipt className="mr-3" />
                                Debit Heads (Expenses)
                            </h3>
                            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                                {debitHeads.length} heads
                            </span>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        {debitHeads.map(head => (
                            <div key={head.id} className="mb-3 p-4 border border-red-100 rounded-lg hover:border-red-300 transition-colors">
                                {renderDebitHeadCard(head)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderCreditHeadCard = (head) => {
        const IconComponent = getCategoryIcon(head.islamic_category, 'credit');
        
        return (
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${head.is_restricted ? 'bg-orange-100' : 'bg-green-100'}`}>
                        <IconComponent className={`${head.is_restricted ? 'text-orange-600' : 'text-green-600'}`} />
                    </div>
                    <div>
                        <h5 className="font-semibold text-gray-900">{head.name}</h5>
                        <p className="text-sm text-gray-600">
                            {getCategoryDisplay(head.islamic_category, 'credit')}
                        </p>
                        {head.is_restricted && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 mt-1">
                                <FaExclamationTriangle className="mr-1" /> Restricted
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(head.current_balance)}
                    </div>
                    <div className="text-sm text-gray-500">
                        Cash: {formatCurrency(head.cash_balance)} | Bank: {formatCurrency(head.bank_balance)}
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                        <button
                            onClick={() => handleEdit(head)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        >
                            <FaEdit size={14} />
                        </button>
                        <button
                            onClick={() => setSelectedHead(head) || setShowDependencyModal(true)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                        >
                            <FaLink size={14} />
                        </button>
                        <button
                            onClick={() => handleDelete(head.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                        >
                            <FaTrash size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render dependencies view
    const renderDependenciesView = () => {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center mb-2">
                        <FaLink className="mr-3 text-indigo-600" />
                        Credit-Debit Dependency Rules
                    </h3>
                    <p className="text-gray-600">
                        Islamic accounting principles determine which credit heads can fund specific debit heads
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Independent Credit Heads */}
                    <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                            <FaBalanceScale className="mr-2 text-green-600" />
                            Independent Credit Heads
                            <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                Can fund any expense
                            </span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getCreditHeads().filter(h => h.dependency_type === 'independent').map(head => (
                                <div key={head.id} className="border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 rounded-lg bg-green-100">
                                            <FaBalanceScale className="text-green-600" />
                                        </div>
                                        <div>
                                            <h5 className="font-semibold text-gray-900">{head.name}</h5>
                                            <p className="text-sm text-gray-600">
                                                {getCategoryDisplay(head.islamic_category, 'credit')}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatCurrency(head.current_balance)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs text-green-700 bg-green-50 p-2 rounded">
                                        Can fund all {getDebitHeads().length} expense heads
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Restricted Credit Heads */}
                    <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                            <FaExclamationTriangle className="mr-2 text-orange-600" />
                            Restricted Credit Heads
                            <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                                Limited usage based on Islamic rules
                            </span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getCreditHeads().filter(h => h.dependency_type === 'dependent' || h.is_restricted).map(head => (
                                <div key={head.id} className="border border-orange-200 rounded-lg p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 rounded-lg bg-orange-100">
                                            <FaExclamationTriangle className="text-orange-600" />
                                        </div>
                                        <div>
                                            <h5 className="font-semibold text-gray-900">{head.name}</h5>
                                            <p className="text-sm text-gray-600">
                                                {getCategoryDisplay(head.islamic_category, 'credit')}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatCurrency(head.current_balance)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs text-orange-700 bg-orange-50 p-2 rounded">
                                        {head.spending_rules || 'Specific Islamic spending rules apply'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* All Expense Heads */}
                    <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                            <FaReceipt className="mr-2 text-red-600" />
                            Expense Heads
                            <span className="ml-2 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                                Can be funded based on dependency rules
                            </span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getDebitHeads().map(head => (
                                <div key={head.id} className="border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 rounded-lg bg-red-100">
                                            <FaReceipt className="text-red-600" />
                                        </div>
                                        <div>
                                            <h5 className="font-semibold text-gray-900">{head.name}</h5>
                                            <p className="text-sm text-gray-600">
                                                {getCategoryDisplay(head.islamic_category, 'debit')}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatCurrency(head.current_balance)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <button
                                            onClick={() => setSelectedHead(head) || setShowDependencyModal(true)}
                                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100"
                                        >
                                            View Funding Sources
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render categories view
    const renderCategoriesView = () => {
        const categoryStats = {};
        
        // Calculate statistics for each category
        ledgerHeads.forEach(head => {
            const category = head.islamic_category || 'Unknown';
            if (!categoryStats[category]) {
                categoryStats[category] = {
                    count: 0,
                    totalBalance: 0,
                    creditBalance: 0,
                    debitBalance: 0,
                    creditHeads: [],
                    debitHeads: []
                };
            }
            categoryStats[category].count++;
            categoryStats[category].totalBalance += parseFloat(head.current_balance || 0);
            
            if (head.head_type === 'credit') {
                categoryStats[category].creditBalance += parseFloat(head.current_balance || 0);
                categoryStats[category].creditHeads.push(head);
            } else {
                categoryStats[category].debitBalance += parseFloat(head.current_balance || 0);
                categoryStats[category].debitHeads.push(head);
            }
        });

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center mb-2">
                        <FaTags className="mr-3 text-indigo-600" />
                        Islamic Categories Overview
                    </h3>
                    <p className="text-gray-600">
                        Categorization of funds according to Islamic accounting principles
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(categoryStats).map(([category, stats]) => {
                        const categoryInfo = [...islamicCategories.credit, ...islamicCategories.debit]
                            .find(cat => cat.value === category);
                        const IconComponent = categoryInfo?.icon || FaTags;
                        
                        return (
                            <div key={category} className="border border-gray-200 rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-3 rounded-lg bg-indigo-100">
                                            <IconComponent className="text-indigo-600" size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">
                                                {categoryInfo ? categoryInfo.label.split(' (')[0] : category}
                                            </h4>
                                            <p className="text-sm text-gray-600">
                                                {categoryInfo ? categoryInfo.label.match(/\\((.*)\\)/)?.[1] : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Total Heads:</span>
                                        <span className="font-medium">{stats.count}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Total Balance:</span>
                                        <span className="font-medium">{formatCurrency(stats.totalBalance)}</span>
                                    </div>
                                    
                                    {stats.creditHeads.length > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-green-600">Credit:</span>
                                            <span className="font-medium text-green-700">
                                                {stats.creditHeads.length} heads • {formatCurrency(stats.creditBalance)}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {stats.debitHeads.length > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-red-600">Debit:</span>
                                            <span className="font-medium text-red-700">
                                                {stats.debitHeads.length} heads • {formatCurrency(stats.debitBalance)}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Restriction indicator */}
                                    {stats.creditHeads.some(h => h.is_restricted) && (
                                        <div className="mt-3 bg-orange-50 border border-orange-200 rounded p-2">
                                            <span className="text-xs text-orange-700 flex items-center">
                                                <FaExclamationTriangle className="mr-1" />
                                                Contains restricted funds
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex flex-wrap gap-2">
                                        {stats.creditHeads.map(head => (
                                            <span key={head.id} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                {head.name}
                                            </span>
                                        ))}
                                        {stats.debitHeads.map(head => (
                                            <span key={head.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                                {head.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderDebitHeadCard = (head) => {
        const IconComponent = getCategoryIcon(head.islamic_category, 'debit');
        
        return (
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-red-100">
                        <IconComponent className="text-red-600" />
                    </div>
                    <div>
                        <h5 className="font-semibold text-gray-900">{head.name}</h5>
                        <p className="text-sm text-gray-600">
                            {getCategoryDisplay(head.islamic_category, 'debit')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Fundable by: Independent funds + specific restrictions
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(head.current_balance)}
                    </div>
                    <div className="text-sm text-gray-500">
                        Cash: {formatCurrency(head.cash_balance)} | Bank: {formatCurrency(head.bank_balance)}
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                        <button
                            onClick={() => handleEdit(head)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        >
                            <FaEdit size={14} />
                        </button>
                        <button
                            onClick={() => setSelectedHead(head) || setShowDependencyModal(true)}
                            className="p-1 text-orange-600 hover:bg-orange-100 rounded"
                        >
                            <FaEye size={14} />
                        </button>
                        <button
                            onClick={() => handleDelete(head.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                        >
                            <FaTrash size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                            <FaBalanceScale className="mr-4 text-indigo-600" />
                            Islamic Ledger Management
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Manage credit-debit relationships with Islamic accounting principles
                        </p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
                        >
                            <FaPlus className="mr-2" />
                            Add New Ledger Head
                        </button>
                        <button
                            onClick={fetchLedgerHeads}
                            className="bg-gray-600 text-white px-4 py-3 rounded-lg flex items-center hover:bg-gray-700 transition-colors"
                        >
                            <FaSync className="mr-2" />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-6 flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <FaSearch className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ledger heads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    
                    <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Accounts</option>
                        {accounts.map(account => (
                            <option key={account.id} value={account.id}>
                                {account.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">All Types</option>
                        <option value="credit">Credit Only</option>
                        <option value="debit">Debit Only</option>
                    </select>
                </div>

                {/* Tab Navigation */}
                <div className="mt-6 border-b border-gray-200">
                    <nav className="flex space-x-8">
                        {[
                            { id: 'overview', label: 'Overview', icon: FaChartLine },
                            { id: 'balance-sheet', label: 'Balance Sheet View', icon: FaBalanceScale },
                            { id: 'dependencies', label: 'Dependencies', icon: FaLink },
                            { id: 'categories', label: 'Categories', icon: FaTags }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                                    activeTab === tab.id
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <tab.icon className="mr-2" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            )}

            {!loading && (
                <>
                    {/* Summary Cards */}
                    {renderSummaryCards()}

                    {/* Tab Content */}
                    {activeTab === 'overview' && renderSummaryCards()}
                    {activeTab === 'balance-sheet' && renderBalanceSheetView()}
                    {activeTab === 'dependencies' && renderDependenciesView()}
                    {activeTab === 'categories' && renderCategoriesView()}
                </>
            )}

            {/* Add/Edit Form Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                                    <FaPlus className="mr-3 text-indigo-600" />
                                    {editingHead ? 'Edit' : 'Add'} Ledger Head
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setEditingHead(null);
                                        resetForm();
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <FaTimesCircle size={24} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Information */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Account
                                    </label>
                                    <select
                                        value={formData.account_id}
                                        onChange={(e) => setFormData({...formData, account_id: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Ledger Head Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                        placeholder="Enter ledger head name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Head Type
                                    </label>
                                    <select
                                        value={formData.head_type}
                                        onChange={(e) => {
                                            const headType = e.target.value;
                                            setFormData({
                                                ...formData, 
                                                head_type: headType,
                                                dependency_type: headType === 'credit' ? 'independent' : 'expense',
                                                islamic_category: headType === 'credit' ? 'General' : 'Expense'
                                            });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        <option value="credit">Credit (Income/Fund)</option>
                                        <option value="debit">Debit (Expense)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Dependency Type
                                    </label>
                                    <select
                                        value={formData.dependency_type}
                                        onChange={(e) => setFormData({...formData, dependency_type: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        disabled={formData.head_type === 'debit'}
                                    >
                                        <option value="independent">Independent (Can fund any expense)</option>
                                        <option value="dependent">Dependent (Restricted usage)</option>
                                        {formData.head_type === 'debit' && (
                                            <option value="expense">Expense Head</option>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Islamic Category
                                    </label>
                                    <select
                                        value={formData.islamic_category}
                                        onChange={(e) => {
                                            const category = e.target.value;
                                            const isRestricted = ['Sahm-e-Imam', 'Sahm-e-Sadat', 'Zakat'].includes(category);
                                            setFormData({
                                                ...formData, 
                                                islamic_category: category,
                                                is_restricted: isRestricted,
                                                dependency_type: isRestricted ? 'dependent' : formData.dependency_type
                                            });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {islamicCategories[formData.head_type]?.map(cat => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Sort Order
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.sort_order}
                                        onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0"
                                    />
                                </div>

                                {/* Balance Information */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Current Balance
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.current_balance}
                                        onChange={(e) => setFormData({...formData, current_balance: parseFloat(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Cash Balance
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.cash_balance}
                                        onChange={(e) => setFormData({...formData, cash_balance: parseFloat(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Bank Balance
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.bank_balance}
                                        onChange={(e) => setFormData({...formData, bank_balance: parseFloat(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Full Width Fields */}
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter description for this ledger head"
                                />
                            </div>

                            {/* Credit-Debit Relationship Section */}
                            {formData.head_type === 'credit' && !editingHead && (
                                <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <FaLink className="mr-2 text-indigo-600" />
                                        Credit-Debit Relationship
                                    </h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Islamic accounting requires establishing proper relationships between credit and debit heads. 
                                        Choose how this credit head should be linked to expense heads.
                                    </p>

                                    {/* Relationship Type Selection */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div 
                                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                                !formData.create_linked_head && !formData.linked_debit_head
                                                    ? 'border-green-500 bg-green-50' 
                                                    : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                            onClick={() => setFormData({
                                                ...formData, 
                                                create_linked_head: false, 
                                                linked_debit_head: ''
                                            })}
                                        >
                                            <div className="flex items-center mb-2">
                                                <FaBalanceScale className="text-green-600 mr-2" />
                                                <span className="font-semibold text-gray-900">Independent Fund</span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Can fund any expense head without restrictions
                                            </p>
                                        </div>

                                        <div 
                                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                                formData.create_linked_head
                                                    ? 'border-blue-500 bg-blue-50' 
                                                    : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                            onClick={() => setFormData({
                                                ...formData, 
                                                create_linked_head: true, 
                                                linked_debit_head: ''
                                            })}
                                        >
                                            <div className="flex items-center mb-2">
                                                <FaPlus className="text-blue-600 mr-2" />
                                                <span className="font-semibold text-gray-900">Create New Pair</span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Create a paired debit head automatically
                                            </p>
                                        </div>

                                        <div 
                                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                                formData.linked_debit_head
                                                    ? 'border-orange-500 bg-orange-50' 
                                                    : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                            onClick={() => setFormData({
                                                ...formData, 
                                                create_linked_head: false, 
                                                linked_debit_head: getDebitHeads()[0]?.id || ''
                                            })}
                                        >
                                            <div className="flex items-center mb-2">
                                                <FaExchangeAlt className="text-orange-600 mr-2" />
                                                <span className="font-semibold text-gray-900">Link Existing</span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Link to an existing debit head
                                            </p>
                                        </div>
                                    </div>

                                    {/* Link to Existing Debit Head */}
                                    {formData.linked_debit_head && !formData.create_linked_head && (
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Select Existing Debit Head to Link
                                            </label>
                                            <select
                                                value={formData.linked_debit_head}
                                                onChange={(e) => setFormData({...formData, linked_debit_head: e.target.value})}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">Select a debit head</option>
                                                {getDebitHeads().map(head => (
                                                    <option key={head.id} value={head.id}>
                                                        {head.name} ({getCategoryDisplay(head.islamic_category, 'debit')})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Preview for New Linked Head */}
                                    {formData.create_linked_head && formData.name && (
                                        <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                                            <div className="flex items-center">
                                                <FaInfoCircle className="text-blue-600 mr-2" />
                                                <span className="text-sm font-medium text-blue-800">
                                                    Will create paired debit head: "{formData.name} - Expenses"
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {formData.is_restricted && (
                                <div className="mt-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Spending Rules
                                    </label>
                                    <textarea
                                        value={formData.spending_rules}
                                        onChange={(e) => setFormData({...formData, spending_rules: e.target.value})}
                                        rows="3"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Define specific rules for spending from this restricted fund"
                                    />
                                </div>
                            )}

                            {/* Restriction Checkbox */}
                            <div className="mt-6">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_restricted}
                                        onChange={(e) => setFormData({...formData, is_restricted: e.target.checked})}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">
                                        This is a restricted fund with specific spending rules
                                    </span>
                                </label>
                            </div>

                            {/* Form Actions */}
                            <div className="mt-8 flex items-center justify-end space-x-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setEditingHead(null);
                                        resetForm();
                                    }}
                                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                                >
                                    <FaCheckCircle className="mr-2" />
                                    {editingHead ? 'Update' : 'Create'} Ledger Head
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Dependency Management Modal */}
            {showDependencyModal && selectedHead && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-screen overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                                    <FaLink className="mr-3 text-indigo-600" />
                                    Dependencies for {selectedHead.name}
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowDependencyModal(false);
                                        setSelectedHead(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <FaTimesCircle size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="mb-6">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className={`p-3 rounded-lg ${
                                                selectedHead.head_type === 'credit' 
                                                    ? selectedHead.is_restricted ? 'bg-orange-100' : 'bg-green-100'
                                                    : 'bg-red-100'
                                            }`}>
                                                {selectedHead.head_type === 'credit' ? (
                                                    <FaCreditCard className={selectedHead.is_restricted ? 'text-orange-600' : 'text-green-600'} size={24} />
                                                ) : (
                                                    <FaReceipt className="text-red-600" size={24} />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">{selectedHead.name}</h3>
                                                <p className="text-sm text-gray-600">
                                                    {getCategoryDisplay(selectedHead.islamic_category, selectedHead.head_type)} • 
                                                    {selectedHead.head_type === 'credit' ? 'Credit Head' : 'Debit Head'} • 
                                                    {selectedHead.dependency_type}
                                                </p>
                                                <p className="text-sm font-medium text-gray-900 mt-1">
                                                    Balance: {formatCurrency(selectedHead.current_balance)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {selectedHead.is_restricted && (
                                            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                                                Restricted Fund
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedHead.head_type === 'credit' ? (
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Can Fund These Debit Heads:</h4>
                                    
                                    {selectedHead.dependency_type === 'independent' ? (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                            <div className="flex items-center">
                                                <FaCheckCircle className="text-green-600 mr-2" />
                                                <span className="text-green-800 font-medium">
                                                    This independent credit head can fund any expense head.
                                                </span>
                                            </div>
                                            <p className="text-green-700 text-sm mt-2">
                                                No specific restrictions apply. Can be used for all organizational expenses.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                                            <div className="flex items-center">
                                                <FaExclamationTriangle className="text-orange-600 mr-2" />
                                                <span className="text-orange-800 font-medium">
                                                    This is a restricted fund with limited usage.
                                                </span>
                                            </div>
                                            <p className="text-orange-700 text-sm mt-2">
                                                Can only fund specific expense heads based on Islamic guidelines and dependency rules.
                                            </p>
                                        </div>
                                    )}
                                    
                                    {/* List of debit heads that can be funded */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {getDebitHeads().map(debitHead => (
                                            <div key={debitHead.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="p-2 rounded-lg bg-red-100">
                                                            <FaReceipt className="text-red-600" />
                                                        </div>
                                                        <div>
                                                            <h5 className="font-medium text-gray-900">{debitHead.name}</h5>
                                                            <p className="text-sm text-gray-600">
                                                                {getCategoryDisplay(debitHead.islamic_category, 'debit')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {selectedHead.dependency_type === 'independent' ? (
                                                            <FaCheckCircle className="text-green-600" />
                                                        ) : (
                                                            <span className="text-xs text-gray-500">Conditional</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Can Be Funded By These Credit Heads:</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {getCreditHeads().filter(creditHead => 
                                            creditHead.dependency_type === 'independent' || 
                                            !creditHead.is_restricted
                                        ).map(creditHead => (
                                            <div key={creditHead.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className={`p-2 rounded-lg ${
                                                            creditHead.is_restricted ? 'bg-orange-100' : 'bg-green-100'
                                                        }`}>
                                                            <FaCreditCard className={creditHead.is_restricted ? 'text-orange-600' : 'text-green-600'} />
                                                        </div>
                                                        <div>
                                                            <h5 className="font-medium text-gray-900">{creditHead.name}</h5>
                                                            <p className="text-sm text-gray-600">
                                                                {getCategoryDisplay(creditHead.islamic_category, 'credit')}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {formatCurrency(creditHead.current_balance)} available
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {creditHead.dependency_type === 'independent' ? (
                                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                                                Full Access
                                                            </span>
                                                        ) : (
                                                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                                                Restricted
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => {
                                        setShowDependencyModal(false);
                                        setSelectedHead(null);
                                    }}
                                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}