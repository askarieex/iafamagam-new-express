import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    FaPlus, FaEdit, FaTrash, FaSync, FaSearch, FaUniversity,
    FaMoneyBillWave, FaCreditCard, FaReceipt, FaLink, FaUnlink,
    FaBalanceScale, FaArrowRight, FaExchangeAlt, FaCheckCircle, 
    FaTimesCircle, FaLock, FaUnlockAlt, FaTimes, FaEye, FaShieldAlt
} from 'react-icons/fa';
import API_CONFIG from '../config';
import { toast } from 'react-hot-toast';

export default function ManageLedgerSimplified() {
    // State management
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingHead, setEditingHead] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAccount, setSelectedAccount] = useState('');
    
    // Relationship management with exclusive one-to-many rule
    const [creditHeads, setCreditHeads] = useState([]);
    const [debitHeads, setDebitHeads] = useState([]);
    const [relationships, setRelationships] = useState([]);
    const [draggedItem, setDraggedItem] = useState(null);
    const [hoveredDebitHead, setHoveredDebitHead] = useState(null);
    
    // Form data - simplified
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

    // Update relationship columns when ledger heads change
    useEffect(() => {
        organizeLedgerHeads();
    }, [ledgerHeads]);

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

    const organizeLedgerHeads = () => {
        const filtered = ledgerHeads.filter(head => {
            if (searchTerm && !head.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            return true;
        });

        const credits = filtered.filter(head => head.head_type === 'credit');
        const debits = filtered.filter(head => head.head_type === 'debit');
        
        setCreditHeads(credits);
        setDebitHeads(debits);
    };

    // Check if a debit head is already connected to any credit head (exclusive rule)
    const isDebitHeadConnected = (debitHeadId) => {
        return relationships.some(rel => rel.debit_head.id === debitHeadId);
    };

    // Get the credit head that owns a specific debit head
    const getDebitHeadOwner = (debitHeadId) => {
        const relationship = relationships.find(rel => rel.debit_head.id === debitHeadId);
        return relationship ? relationship.credit_head : null;
    };

    // Get all debit heads connected to a specific credit head
    const getCreditHeadTargets = (creditHeadId) => {
        return relationships.filter(rel => rel.credit_head.id === creditHeadId);
    };

    // Check if a debit head can accept a connection from a credit head
    const canConnect = (creditHeadId, debitHeadId) => {
        return !isDebitHeadConnected(debitHeadId);
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
                // Remove any relationships involving this head
                setRelationships(prev => prev.filter(rel => 
                    rel.credit_head.id !== id && rel.debit_head.id !== id
                ));
                
                toast.success('Ledger head deleted successfully');
                fetchLedgerHeads();
            }
        } catch (error) {
            console.error('Error deleting ledger head:', error);
            toast.error('Failed to delete ledger head');
        }
    };

    // Enhanced drag and drop handlers with exclusive relationship rules
    const handleDragStart = (e, item, source) => {
        setDraggedItem({ item, source });
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.6';
        e.target.style.transform = 'rotate(3deg)';
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        e.target.style.transform = 'rotate(0deg)';
        setDraggedItem(null);
        setHoveredDebitHead(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e, targetHead) => {
        e.preventDefault();
        if (draggedItem && draggedItem.source === 'credit' && targetHead.head_type === 'debit') {
            setHoveredDebitHead(targetHead.id);
        }
    };

    const handleDragLeave = (e, targetHead) => {
        if (hoveredDebitHead === targetHead.id) {
            setHoveredDebitHead(null);
        }
    };

    const handleDropOnItem = (e, targetItem) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedItem) return;

        const { item: sourceItem, source } = draggedItem;
        
        // Only allow credit to debit connections
        if (source !== 'credit' || targetItem.head_type !== 'debit') {
            setDraggedItem(null);
            setHoveredDebitHead(null);
            return;
        }

        // Check exclusive rule: debit head must not be already connected
        if (isDebitHeadConnected(targetItem.id)) {
            const owner = getDebitHeadOwner(targetItem.id);
            toast.error(`${targetItem.name} is already exclusively connected to ${owner.name}!`);
            setDraggedItem(null);
            setHoveredDebitHead(null);
            return;
        }

        // Create the exclusive relationship
        createRelationship(sourceItem, targetItem);
        setDraggedItem(null);
        setHoveredDebitHead(null);
    };

    const createRelationship = (creditHead, debitHead) => {
        // Double-check the exclusive rule
        if (isDebitHeadConnected(debitHead.id)) {
            toast.error('This debit head is already exclusively connected!');
            return;
        }

        const newRelationship = {
            id: Date.now(),
            credit_head: creditHead,
            debit_head: debitHead,
            created_at: new Date(),
            restriction_type: 'exclusive',
            notes: `Exclusive connection: ${creditHead.name} → ${debitHead.name}`
        };

        setRelationships(prev => [...prev, newRelationship]);
        toast.success(`🔗 ${creditHead.name} now exclusively funds ${debitHead.name}`, {
            duration: 4000,
            position: 'top-right'
        });
    };

    const removeRelationship = (relationshipId) => {
        const relationship = relationships.find(rel => rel.id === relationshipId);
        if (relationship) {
            setRelationships(prev => prev.filter(rel => rel.id !== relationshipId));
            toast.success(`🔓 ${relationship.debit_head.name} is now available for new connections`);
        }
    };

    // Get visual state for debit heads during drag operations
    const getDebitHeadState = (debitHead) => {
        const isConnected = isDebitHeadConnected(debitHead.id);
        const canAcceptDrop = draggedItem && draggedItem.source === 'credit' && !isConnected;
        const isHovered = hoveredDebitHead === debitHead.id;
        
        return {
            isConnected,
            canAcceptDrop,
            isHovered,
            owner: isConnected ? getDebitHeadOwner(debitHead.id) : null
        };
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
                            <FaBalanceScale className="mr-4 text-blue-600" />
                            Islamic Ledger Management
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Exclusive one-to-many credit-debit relationships for proper fund segregation
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
                <>
                    {/* Ledger Heads Table by Account */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                <FaUniversity className="mr-3 text-blue-600" />
                                Ledger Heads Overview
                            </h2>
                            <p className="text-gray-600 mt-1">
                                All created ledger heads organized by account
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
                                Object.entries(groupedByAccount()).map(([accountName, heads]) => (
                                    <div key={accountName} className="mb-8 last:mb-0">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                            <FaUniversity className="mr-2 text-blue-600" />
                                            {accountName}
                                            <span className="ml-2 bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                                                {heads.length} heads
                                            </span>
                                        </h3>
                                        
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-gray-50">
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Type</th>
                                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Connection Status</th>
                                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Balance</th>
                                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {heads.map(head => {
                                                        const isConnected = isDebitHeadConnected(head.id);
                                                        const owner = head.head_type === 'debit' ? getDebitHeadOwner(head.id) : null;
                                                        const targets = head.head_type === 'credit' ? getCreditHeadTargets(head.id) : [];
                                                        
                                                        return (
                                                            <tr 
                                                                key={head.id}
                                                                className="border-t border-gray-200 hover:bg-gray-50 transition-colors"
                                                            >
                                                                <td className="px-4 py-4">
                                                                    <div className="flex items-center">
                                                                        {head.head_type === 'credit' ? (
                                                                            <FaCreditCard className="mr-2 text-green-600" />
                                                                        ) : (
                                                                            <div className="flex items-center mr-2">
                                                                                <FaReceipt className="text-red-600" />
                                                                                {isConnected && <FaLock className="ml-1 text-orange-600" size={12} />}
                                                                            </div>
                                                                        )}
                                                                        <span className="font-medium text-gray-900">{head.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 text-center">
                                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                                                        head.head_type === 'credit' 
                                                                            ? 'bg-green-100 text-green-800' 
                                                                            : 'bg-red-100 text-red-800'
                                                                    }`}>
                                                                        {head.head_type === 'credit' ? 'Credit' : 'Debit'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 text-center">
                                                                    {head.head_type === 'credit' ? (
                                                                        targets.length > 0 ? (
                                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                                                <FaShieldAlt className="mr-1" size={10} />
                                                                                Restricted ({targets.length} connections)
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                                <FaUnlockAlt className="mr-1" size={10} />
                                                                                Independent
                                                                            </span>
                                                                        )
                                                                    ) : (
                                                                        isConnected ? (
                                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                                <FaLock className="mr-1" size={10} />
                                                                                Owned by {owner.name}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                                <FaUnlockAlt className="mr-1" size={10} />
                                                                                Available
                                                                            </span>
                                                                        )
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-4 text-right font-mono">
                                                                    {formatCurrency(head.current_balance)}
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="flex items-center justify-center space-x-2">
                                                                        <button
                                                                            onClick={() => handleEdit(head)}
                                                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                                                                            title="Edit ledger head"
                                                                        >
                                                                            <FaEdit size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(head.id)}
                                                                            className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                                                            title="Delete ledger head"
                                                                        >
                                                                            <FaTrash size={14} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Exclusive Relationship Management Interface */}
                    {(creditHeads.length > 0 || debitHeads.length > 0) && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                            <div className="p-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <FaExchangeAlt className="mr-3 text-purple-600" />
                                    Exclusive Credit-Debit Relationship Management
                                </h2>
                                <p className="text-gray-600 mt-1">
                                    One credit head can fund multiple debits, but each debit can only be funded by one credit head
                                </p>
                            </div>
                            
                            <div className="p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Credit Heads Column */}
                                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-dashed border-green-300 rounded-xl p-6 min-h-[500px]">
                                        <div className="flex items-center mb-6">
                                            <FaCreditCard className="text-3xl text-green-600 mr-3" />
                                            <div>
                                                <h3 className="text-xl font-semibold text-green-800">Credit Heads (Fund Sources)</h3>
                                                <p className="text-sm text-green-700">Drag from here to connect to debit heads</p>
                                            </div>
                                        </div>

                                        {creditHeads.length === 0 ? (
                                            <div className="text-center py-12">
                                                <FaCreditCard className="text-5xl text-green-300 mx-auto mb-4" />
                                                <p className="text-green-600 font-medium">No credit heads available</p>
                                                <p className="text-sm text-green-500 mt-2">Create credit type ledger heads first</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {creditHeads.map(head => {
                                                    const targets = getCreditHeadTargets(head.id);
                                                    const isRestricted = targets.length > 0;
                                                    
                                                    return (
                                                        <div 
                                                            key={head.id}
                                                            className={`bg-white border-2 rounded-xl p-5 transition-all cursor-grab hover:shadow-lg ${
                                                                isRestricted 
                                                                    ? 'border-orange-300 bg-orange-50' 
                                                                    : 'border-green-300 hover:border-green-400'
                                                            }`}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, head, 'credit')}
                                                            onDragEnd={handleDragEnd}
                                                        >
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div>
                                                                    <h4 className="font-bold text-gray-900 text-lg">{head.name}</h4>
                                                                    <p className="text-sm text-gray-600">{formatCurrency(head.current_balance)}</p>
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    {isRestricted ? (
                                                                        <FaShieldAlt className="text-orange-600" />
                                                                    ) : (
                                                                        <FaUnlockAlt className="text-green-600" />
                                                                    )}
                                                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                                                        isRestricted 
                                                                            ? 'bg-orange-100 text-orange-700' 
                                                                            : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                        {isRestricted ? `${targets.length} connections` : 'Independent'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Show connected debit heads */}
                                                            {targets.map(rel => (
                                                                <div key={rel.id} className="mt-3 pt-3 border-t border-orange-200">
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <div className="flex items-center">
                                                                            <FaArrowRight className="text-orange-600 mr-2" />
                                                                            <span className="text-gray-700 font-medium">{rel.debit_head.name}</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => removeRelationship(rel.id)}
                                                                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                                                                            title="Remove exclusive connection"
                                                                        >
                                                                            <FaTimes size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Debit Heads Column */}
                                    <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-dashed border-red-300 rounded-xl p-6 min-h-[500px]">
                                        <div className="flex items-center mb-6">
                                            <FaReceipt className="text-3xl text-red-600 mr-3" />
                                            <div>
                                                <h3 className="text-xl font-semibold text-red-800">Debit Heads (Expense Targets)</h3>
                                                <p className="text-sm text-red-700">Drop credit heads here to create exclusive connections</p>
                                            </div>
                                        </div>

                                        {debitHeads.length === 0 ? (
                                            <div className="text-center py-12">
                                                <FaReceipt className="text-5xl text-red-300 mx-auto mb-4" />
                                                <p className="text-red-600 font-medium">No debit heads available</p>
                                                <p className="text-sm text-red-500 mt-2">Create debit type ledger heads first</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {debitHeads.map(head => {
                                                    const state = getDebitHeadState(head);
                                                    
                                                    return (
                                                        <div 
                                                            key={head.id}
                                                            className={`bg-white border-2 rounded-xl p-5 transition-all ${
                                                                state.canAcceptDrop && state.isHovered
                                                                    ? 'border-green-500 bg-green-50 shadow-lg scale-105' 
                                                                    : state.canAcceptDrop
                                                                    ? 'border-green-400 bg-green-50'
                                                                    : state.isConnected
                                                                    ? 'border-blue-300 bg-blue-50'
                                                                    : draggedItem
                                                                    ? 'border-gray-300 bg-gray-50'
                                                                    : 'border-red-300 hover:border-red-400'
                                                            }`}
                                                            onDragOver={handleDragOver}
                                                            onDragEnter={(e) => handleDragEnter(e, head)}
                                                            onDragLeave={(e) => handleDragLeave(e, head)}
                                                            onDrop={(e) => handleDropOnItem(e, head)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h4 className="font-bold text-gray-900 text-lg flex items-center">
                                                                        {head.name}
                                                                        {state.isConnected && <FaLock className="ml-2 text-blue-600" size={16} />}
                                                                    </h4>
                                                                    <p className="text-sm text-gray-600">{formatCurrency(head.current_balance)}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                                                        state.isConnected
                                                                            ? 'bg-blue-100 text-blue-700'
                                                                            : state.canAcceptDrop
                                                                            ? 'bg-green-100 text-green-700'
                                                                            : draggedItem
                                                                            ? 'bg-gray-100 text-gray-700'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                        {state.isConnected ? 'Owned' : 'Available'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Show owner if connected */}
                                                            {state.isConnected && (
                                                                <div className="mt-3 pt-3 border-t border-blue-200">
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <div className="flex items-center">
                                                                            <FaArrowRight className="text-blue-600 mr-2 transform rotate-180" />
                                                                            <span className="text-gray-700">Funded by: <strong>{state.owner.name}</strong></span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Enhanced Statistics and Instructions */}
                                <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                        <FaLink className="text-3xl text-blue-600 mx-auto mb-2" />
                                        <h4 className="font-semibold text-blue-800">Total Connections</h4>
                                        <p className="text-2xl font-bold text-blue-900">{relationships.length}</p>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                        <FaUnlockAlt className="text-3xl text-green-600 mx-auto mb-2" />
                                        <h4 className="font-semibold text-green-800">Independent Credits</h4>
                                        <p className="text-2xl font-bold text-green-900">
                                            {creditHeads.filter(head => getCreditHeadTargets(head.id).length === 0).length}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                                        <FaShieldAlt className="text-3xl text-orange-600 mx-auto mb-2" />
                                        <h4 className="font-semibold text-orange-800">Restricted Credits</h4>
                                        <p className="text-2xl font-bold text-orange-900">
                                            {creditHeads.filter(head => getCreditHeadTargets(head.id).length > 0).length}
                                        </p>
                                    </div>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                                        <FaLock className="text-3xl text-red-600 mx-auto mb-2" />
                                        <h4 className="font-semibold text-red-800">Owned Debits</h4>
                                        <p className="text-2xl font-bold text-red-900">
                                            {debitHeads.filter(head => isDebitHeadConnected(head.id)).length}
                                        </p>
                                    </div>
                                </div>

                                {/* Enhanced Instructions */}
                                <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-xl">
                                    <div className="flex items-start">
                                        <FaExchangeAlt className="text-blue-600 mr-4 mt-1 text-2xl" />
                                        <div className="flex-1">
                                            <h4 className="font-bold text-blue-900 mb-3 text-lg">Exclusive Relationship Rules</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <h5 className="font-semibold text-blue-800 mb-2">✅ Allowed Operations:</h5>
                                                    <ul className="text-sm text-blue-700 space-y-1">
                                                        <li>• One credit head → Multiple debit heads</li>
                                                        <li>• Independent credits fund any available debit</li>
                                                        <li>• Click ✕ to break exclusive connections</li>
                                                        <li>• Visual feedback shows connection status</li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h5 className="font-semibold text-orange-800 mb-2">🚫 Exclusive Rules:</h5>
                                                    <ul className="text-sm text-orange-700 space-y-1">
                                                        <li>• Each debit head can only have ONE credit source</li>
                                                        <li>• Once connected, debit becomes "owned" exclusively</li>
                                                        <li>• Red highlighting shows unavailable debits</li>
                                                        <li>• Ensures Islamic fund segregation compliance</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Simplified Add/Edit Form Modal */}
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
                                    placeholder="e.g., Donation/Nazar, Pay of employees, S.T.M"
                                />
                            </div>

                            {/* Head Type */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Head Type *
                                </label>
                                <div className="flex space-x-6">
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
                                            <div className="font-medium">Credit (Income/Fund)</div>
                                            <div className="text-xs text-gray-500">Fund sources like donations</div>
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
                                            <div className="text-xs text-gray-500">Expense targets like salaries</div>
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