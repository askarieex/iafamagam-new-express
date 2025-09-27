import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaPlus, FaEdit, FaTrash, FaSync, FaSearch, FaUniversity,
    FaCreditCard, FaReceipt, FaCheckCircle, FaTimesCircle,
    FaMoneyBillWave, FaLandmark, FaWallet, FaArrowUp, FaArrowDown,
    FaChartLine, FaChartPie
} from 'react-icons/fa';
import API_CONFIG from '../config';
import { toast } from 'react-hot-toast';

export default function ManageLedger() {
    // State management
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingHead, setEditingHead] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAccount, setSelectedAccount] = useState('');

    // Form data
    const [formData, setFormData] = useState({
        account_id: '',
        name: '',
        head_type: 'credit',
        description: ''
    });

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
            fetchAccounts()
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

    // Group ledger heads by account for table display
    const groupedByAccount = () => {
        const filtered = ledgerHeads.filter(head => {
            if (searchTerm && !head.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            if (selectedAccount && head.account_id.toString() !== selectedAccount) {
                return false;
            }
            return true;
        });

        return filtered.reduce((groups, head) => {
            const accountName = head.account?.name || 'Unknown Account';
            if (!groups[accountName]) {
                groups[accountName] = [];
            }
            groups[accountName].push(head);
            return groups;
        }, {});
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingHead ? `/api/ledger-heads/${editingHead.id}` : '/api/ledger-heads';
            const method = editingHead ? 'PUT' : 'POST';

            // Add default values for backend compatibility
            const submitData = {
                ...formData,
                dependency_type: formData.head_type === 'credit' ? 'independent' : 'expense',
                islamic_category: formData.head_type === 'credit' ? 'General' : 'Expense',
                current_balance: 0,
                cash_balance: 0,
                bank_balance: 0,
                is_restricted: false,
                sort_order: 0
            };

            const response = await api.request({
                method,
                url,
                data: submitData
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
            description: ''
        });
    };

    const handleEdit = (head) => {
        setFormData({
            account_id: head.account_id,
            name: head.name,
            head_type: head.head_type,
            description: head.description || ''
        });
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

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                            <FaUniversity className="mr-4 text-blue-600" />
                            Ledger Head Management
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Manage credit (income) and debit (expense) ledger heads for your accounts
                        </p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center hover:bg-blue-700 transition-colors shadow-lg"
                        >
                            <FaPlus className="mr-2" />
                            Add Ledger Head
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
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Accounts</option>
                        {accounts.map(account => (
                            <option key={account.id} value={account.id}>
                                {account.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            )}

            {!loading && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                            <FaUniversity className="mr-3 text-blue-600" />
                            Ledger Heads Overview
                        </h2>
                        <p className="text-gray-600 mt-1">
                            All ledger heads organized by account
                        </p>
                    </div>

                    <div className="p-6">
                        {Object.entries(groupedByAccount()).length === 0 ? (
                            <div className="text-center py-12">
                                <FaReceipt className="text-6xl text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Ledger Heads Found</h3>
                                <p className="text-gray-500 mb-6">Start by creating your first ledger head</p>
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Create First Ledger Head
                                </button>
                            </div>
                        ) : (
                            Object.entries(groupedByAccount()).map(([accountName, heads]) => {
                                const creditHeads = heads.filter(h => h.head_type === 'credit');
                                const debitHeads = heads.filter(h => h.head_type === 'debit');

                                return (
                                    <div key={accountName} className="mb-12 last:mb-0">
                                        {/* Account Header */}
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-xl">
                                            <h3 className="text-xl font-bold flex items-center">
                                                <FaUniversity className="mr-3" />
                                                {accountName}
                                                <span className="ml-auto bg-blue-500 text-white text-sm px-3 py-1 rounded-full">
                                                    {heads.length} Ledger Heads
                                                </span>
                                            </h3>
                                        </div>

                                        {/* Combined Table Layout */}
                                        <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl overflow-hidden">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[400px]">

                                                {/* Credit Heads Table */}
                                                <div className="border-r border-gray-200 lg:border-r lg:border-gray-200">
                                                    <div className="bg-green-50 border-b border-green-200 px-6 py-3">
                                                        <h4 className="font-semibold text-green-800 flex items-center">
                                                            <FaArrowDown className="mr-2 text-green-600" />
                                                            Credit Heads (Income)
                                                            <span className="ml-auto bg-green-200 text-green-800 text-xs px-2 py-1 rounded-full">
                                                                {creditHeads.length}
                                                            </span>
                                                        </h4>
                                                    </div>

                                                    {/* Credit Table */}
                                                    {creditHeads.length === 0 ? (
                                                        <div className="text-center py-12 text-green-600">
                                                            <FaCreditCard className="text-4xl mx-auto mb-3 opacity-40" />
                                                            <p className="text-sm">No credit heads found</p>
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full">
                                                                <thead className="bg-green-25">
                                                                    <tr className="text-xs border-b border-green-100">
                                                                        <th className="px-4 py-2 text-left font-medium text-green-800">Name</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-green-800">Cash</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-green-800">Bank</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-green-800">Total</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-green-800">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {creditHeads.map((head, index) => (
                                                                        <tr key={head.id} className={`border-b border-green-50 hover:bg-green-25 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-green-25/30'}`}>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center">
                                                                                    <FaCreditCard className="mr-2 text-green-600 text-sm" />
                                                                                    <span className="font-medium text-gray-900 text-sm">{head.name}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3 text-center">
                                                                                <div className="flex flex-col items-center">
                                                                                    <FaWallet className="text-yellow-600 mb-1" size={12} />
                                                                                    <span className="font-mono text-xs font-semibold text-yellow-900">
                                                                                        {formatCurrency(head.cash_balance || 0)}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3 text-center">
                                                                                <div className="flex flex-col items-center">
                                                                                    <FaLandmark className="text-blue-600 mb-1" size={12} />
                                                                                    <span className="font-mono text-xs font-semibold text-blue-900">
                                                                                        {formatCurrency(head.bank_balance || 0)}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3 text-center">
                                                                                <div className="flex flex-col items-center">
                                                                                    <FaChartLine className="text-green-700 mb-1" size={12} />
                                                                                    <span className="font-mono text-sm font-bold text-green-900">
                                                                                        {formatCurrency(head.current_balance || 0)}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3">
                                                                                <div className="flex items-center justify-center space-x-1">
                                                                                    <button
                                                                                        onClick={() => handleEdit(head)}
                                                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                                                        title="Edit"
                                                                                    >
                                                                                        <FaEdit size={10} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDelete(head.id)}
                                                                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                                                        title="Delete"
                                                                                    >
                                                                                        <FaTrash size={10} />
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Debit Heads Table */}
                                                <div>
                                                    <div className="bg-red-50 border-b border-red-200 px-6 py-3">
                                                        <h4 className="font-semibold text-red-800 flex items-center">
                                                            <FaArrowUp className="mr-2 text-red-600" />
                                                            Debit Heads (Expenses)
                                                            <span className="ml-auto bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full">
                                                                {debitHeads.length}
                                                            </span>
                                                        </h4>
                                                    </div>

                                                    {/* Debit Table */}
                                                    {debitHeads.length === 0 ? (
                                                        <div className="text-center py-12 text-red-600">
                                                            <FaReceipt className="text-4xl mx-auto mb-3 opacity-40" />
                                                            <p className="text-sm">No debit heads found</p>
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full">
                                                                <thead className="bg-red-25">
                                                                    <tr className="text-xs border-b border-red-100">
                                                                        <th className="px-4 py-2 text-left font-medium text-red-800">Name</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-red-800">Cash</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-red-800">Bank</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-red-800">Total</th>
                                                                        <th className="px-2 py-2 text-center font-medium text-red-800">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {debitHeads.map((head, index) => (
                                                                        <tr key={head.id} className={`border-b border-red-50 hover:bg-red-25 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-red-25/30'}`}>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center">
                                                                                    <FaReceipt className="mr-2 text-red-600 text-sm" />
                                                                                    <span className="font-medium text-gray-900 text-sm">{head.name}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3 text-center">
                                                                                <div className="flex flex-col items-center">
                                                                                    <FaWallet className="text-yellow-600 mb-1" size={12} />
                                                                                    <span className="font-mono text-xs font-semibold text-yellow-900">
                                                                                        {formatCurrency(head.cash_balance || 0)}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3 text-center">
                                                                                <div className="flex flex-col items-center">
                                                                                    <FaLandmark className="text-blue-600 mb-1" size={12} />
                                                                                    <span className="font-mono text-xs font-semibold text-blue-900">
                                                                                        {formatCurrency(head.bank_balance || 0)}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3 text-center">
                                                                                <div className="flex flex-col items-center">
                                                                                    <FaChartPie className="text-red-700 mb-1" size={12} />
                                                                                    <span className="font-mono text-sm font-bold text-red-900">
                                                                                        {formatCurrency(Math.abs(head.current_balance || 0))}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-3">
                                                                                <div className="flex items-center justify-center space-x-1">
                                                                                    <button
                                                                                        onClick={() => handleEdit(head)}
                                                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                                                        title="Edit"
                                                                                    >
                                                                                        <FaEdit size={10} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDelete(head.id)}
                                                                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                                                        title="Delete"
                                                                                    >
                                                                                        <FaTrash size={10} />
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Add/Edit Form Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                    <FaPlus className="mr-3 text-blue-600" />
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
                                    <FaTimesCircle size={20} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            {/* Account Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Account *
                                </label>
                                <select
                                    value={formData.account_id}
                                    onChange={(e) => setFormData({...formData, account_id: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                            {/* Ledger Head Name */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Ledger Head Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    placeholder="e.g., Donation, Salary, Office Rent"
                                />
                            </div>

                            {/* Head Type */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Head Type *
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="head_type"
                                            value="credit"
                                            checked={formData.head_type === 'credit'}
                                            onChange={(e) => setFormData({...formData, head_type: e.target.value})}
                                            className="mr-3 text-blue-600 focus:ring-blue-500"
                                        />
                                        <FaCreditCard className="mr-2 text-green-600" />
                                        <div>
                                            <div className="font-medium">Credit (Income)</div>
                                            <div className="text-xs text-gray-500">Money coming in</div>
                                        </div>
                                    </label>
                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="head_type"
                                            value="debit"
                                            checked={formData.head_type === 'debit'}
                                            onChange={(e) => setFormData({...formData, head_type: e.target.value})}
                                            className="mr-3 text-blue-600 focus:ring-blue-500"
                                        />
                                        <FaReceipt className="mr-2 text-red-600" />
                                        <div>
                                            <div className="font-medium">Debit (Expense)</div>
                                            <div className="text-xs text-gray-500">Money going out</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Optional description for this ledger head"
                                />
                            </div>

                            {/* Form Actions */}
                            <div className="flex items-center justify-end space-x-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setEditingHead(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                                >
                                    <FaCheckCircle className="mr-2" />
                                    {editingHead ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}