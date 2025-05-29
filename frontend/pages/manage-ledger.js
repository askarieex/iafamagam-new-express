import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaPlus, FaEdit, FaTrash, FaSync, FaFilter,
    FaChartBar, FaTag, FaSearch, FaAngleDown,
    FaMoneyBillWave, FaUniversity
} from 'react-icons/fa';
import API_CONFIG from '../config';

export default function ManageLedger() {

    // State variables
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
    const [currentLedgerHead, setCurrentLedgerHead] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [filterAccountId, setFilterAccountId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Form data
    const [formData, setFormData] = useState({
        account_id: '',
        name: '',
        head_type: 'debit',
        current_balance: 0,
        cash_balance: 0,
        bank_balance: 0,
        description: ''
    });

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch all ledger heads
    const fetchLedgerHeads = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query parameter for filtering
            let url = '/api/ledger-heads';
            if (filterAccountId) {
                url += `?account_id=${filterAccountId}`;
            }

            const response = await api.get(url);

            if (response.data && response.data.data) {
                setLedgerHeads(response.data.data);
            } else {
                setLedgerHeads([]);
                console.warn('Unexpected API response format:', response.data);
            }
        } catch (err) {
            console.error('Error fetching ledger heads:', err);

            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                setError(`Failed to fetch ledger heads. Server responded with: ${err.response.status} ${err.response.statusText}`);
            } else {
                setError(`Failed to fetch ledger heads: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch all accounts for dropdown
    const fetchAccounts = async () => {
        try {
            const response = await api.get('/api/accounts');

            if (response.data && response.data.data) {
                setAccounts(response.data.data);

                // Set first account as default if adding new record
                if (response.data.data.length > 0 && formMode === 'add' && !formData.account_id) {
                    setFormData(prev => ({
                        ...prev,
                        account_id: response.data.data[0].id
                    }));
                }
            } else {
                setAccounts([]);
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);
            // We don't set the main error state here to avoid overriding ledger head errors
        }
    };

    // Load data on component mount
    useEffect(() => {
        fetchLedgerHeads();
        fetchAccounts();
    }, [filterAccountId]);

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // For numeric fields, ensure they are parsed as numbers
        if (['current_balance', 'cash_balance', 'bank_balance'].includes(name)) {
            setFormData({
                ...formData,
                [name]: parseFloat(value) || 0
            });

            // If updating current_balance, auto-update cash_balance to match
            if (name === 'current_balance') {
                const newBalance = parseFloat(value) || 0;
                const oldTotal = parseFloat(formData.cash_balance) + parseFloat(formData.bank_balance);

                if (formMode === 'add' || oldTotal === 0) {
                    // In add mode or if total is 0, set cash_balance to match current_balance
                    setFormData(prev => ({
                        ...prev,
                        current_balance: newBalance,
                        cash_balance: newBalance
                    }));
                }
            }

            // If updating cash or bank balance, update current_balance to match
            if (name === 'cash_balance' || name === 'bank_balance') {
                const cashBalance = name === 'cash_balance' ? parseFloat(value) || 0 : parseFloat(formData.cash_balance) || 0;
                const bankBalance = name === 'bank_balance' ? parseFloat(value) || 0 : parseFloat(formData.bank_balance) || 0;
                const total = cashBalance + bankBalance;

                setFormData(prev => ({
                    ...prev,
                    [name]: parseFloat(value) || 0,
                    current_balance: total
                }));
            }
        } else {
            // For non-numeric fields, just update the value
            setFormData({
                ...formData,
                [name]: value
            });
        }
    };

    // Reset form to initial state
    const resetForm = () => {
        setFormData({
            account_id: accounts.length > 0 ? accounts[0].id : '',
            name: '',
            head_type: 'debit',
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0,
            description: ''
        });
        setCurrentLedgerHead(null);
        setFormMode('add');
    };

    // Open form for adding a new ledger head
    const handleAddNew = () => {
        resetForm();
        setFormMode('add');
        setShowForm(true);
    };

    // Open form for editing an existing ledger head
    const handleEdit = (ledgerHead) => {
        setFormData({
            account_id: ledgerHead.account_id,
            name: ledgerHead.name,
            head_type: ledgerHead.head_type,
            current_balance: ledgerHead.current_balance,
            cash_balance: ledgerHead.cash_balance || 0,
            bank_balance: ledgerHead.bank_balance || 0,
            description: ledgerHead.description || ''
        });
        setCurrentLedgerHead(ledgerHead);
        setFormMode('edit');
        setShowForm(true);
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);

            if (formMode === 'add') {
                // Create new ledger head
                await api.post('/api/ledger-heads', formData);
            } else {
                // Update existing ledger head
                await api.patch(`/api/ledger-heads/${currentLedgerHead.id}`, formData);
            }

            // Refresh ledger heads list
            await fetchLedgerHeads();

            // Reset and close form
            resetForm();
            setShowForm(false);

        } catch (err) {
            console.error(`Error ${formMode === 'add' ? 'creating' : 'updating'} ledger head:`, err);

            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to ${formMode} ledger head: ${err.response.data.message}`);
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else {
                setError(`Failed to ${formMode} ledger head: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle ledger head deletion
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this ledger head?')) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await api.delete(`/api/ledger-heads/${id}`);
            await fetchLedgerHeads();
        } catch (err) {
            console.error('Error deleting ledger head:', err);

            if (err.response && err.response.data && err.response.data.message) {
                // Handle specific foreign key constraint error message from backend
                setError(`Failed to delete ledger head: ${err.response.data.message}`);
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else {
                setError(`Failed to delete ledger head: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Search filter
    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    // Filter and search ledger heads
    const filteredLedgerHeads = ledgerHeads.filter(head => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            head.name.toLowerCase().includes(searchLower) ||
            (head.description && head.description.toLowerCase().includes(searchLower)) ||
            (head.account?.name && head.account.name.toLowerCase().includes(searchLower))
        );
    });

    // Clear filters
    const clearFilters = () => {
        setFilterAccountId('');
        setSearchTerm('');
    };

    // Format currency
    const formatCurrency = (amount) => {
        return parseFloat(amount).toFixed(2);
    };

    // Calculate summary statistics
    const totalDebitHeads = ledgerHeads.filter(head => head.head_type === 'debit').length;
    const totalCreditHeads = ledgerHeads.filter(head => head.head_type === 'credit').length;

    const totalDebitBalance = ledgerHeads
        .filter(head => head.head_type === 'debit')
        .reduce((sum, head) => sum + parseFloat(head.current_balance || 0), 0);

    const totalCreditBalance = ledgerHeads
        .filter(head => head.head_type === 'credit')
        .reduce((sum, head) => sum + parseFloat(head.current_balance || 0), 0);

    const totalCashBalance = ledgerHeads
        .reduce((sum, head) => sum + parseFloat(head.cash_balance || 0), 0);

    const totalBankBalance = ledgerHeads
        .reduce((sum, head) => sum + parseFloat(head.bank_balance || 0), 0);

    return (
        <div className="ledger-heads-page">
            <div className="content-wrapper">
                <div className="page-header">
                    <h1><FaTag /> Manage Ledger Heads</h1>
                    <button className="btn-add" onClick={handleAddNew}>
                        <FaPlus /> Add New Ledger Head
                    </button>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                        <button className="btn-retry" onClick={fetchLedgerHeads}>
                            <FaSync /> Retry
                        </button>
                    </div>
                )}

                <div className="filters-bar">
                    <div className="filter-group">
                        <label htmlFor="filterAccount">
                            <FaFilter className="filter-icon" /> Account:
                        </label>
                        <div className="select-container">
                            <select
                                id="filterAccount"
                                value={filterAccountId}
                                onChange={(e) => setFilterAccountId(e.target.value)}
                                className="filter-select"
                            >
                                <option value="">All Accounts</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                            <FaAngleDown className="select-arrow" />
                        </div>
                    </div>

                    <div className="search-group">
                        <div className="search-input-wrapper">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search ledger heads..."
                                value={searchTerm}
                                onChange={handleSearch}
                                className="search-input"
                            />
                            {(searchTerm || filterAccountId) && (
                                <button
                                    className="btn-clear-filter"
                                    onClick={clearFilters}
                                    title="Clear filters"
                                >
                                    <FaSync />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="content-card">
                    <div className="table-container">
                        {loading ? (
                            <div className="loading">Loading ledger heads...</div>
                        ) : (
                            <>
                                <table className="ledger-heads-table">
                                    <thead>
                                        <tr>
                                            <th>NAME</th>
                                            <th>ACCOUNT</th>
                                            <th>TYPE</th>
                                            <th>TOTAL</th>
                                            <th>CASH</th>
                                            <th>BANK</th>
                                            <th>DESCRIPTION</th>
                                            <th>ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLedgerHeads.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="no-data">
                                                    {searchTerm || filterAccountId ?
                                                        "No matching ledger heads found" :
                                                        "No ledger heads found. Add your first ledger head to get started."}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLedgerHeads.map(ledgerHead => (
                                                <tr key={ledgerHead.id} className="ledger-row">
                                                    <td>{ledgerHead.name}</td>
                                                    <td>{ledgerHead.account?.name || 'Unknown Account'}</td>
                                                    <td>
                                                        <span className={`type-badge ${ledgerHead.head_type}`}>
                                                            {ledgerHead.head_type}
                                                        </span>
                                                    </td>
                                                    <td className="balance">
                                                        {formatCurrency(ledgerHead.current_balance)}
                                                    </td>
                                                    <td className="balance">
                                                        <span className="cash-badge">
                                                            {formatCurrency(ledgerHead.cash_balance)}
                                                        </span>
                                                    </td>
                                                    <td className="balance">
                                                        <span className="bank-badge">
                                                            {formatCurrency(ledgerHead.bank_balance)}
                                                        </span>
                                                    </td>
                                                    <td className="description">{ledgerHead.description || 'N/A'}</td>
                                                    <td className="actions">
                                                        <button
                                                            className="btn-edit"
                                                            onClick={() => handleEdit(ledgerHead)}
                                                            title="Edit"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button
                                                            className="btn-delete"
                                                            onClick={() => handleDelete(ledgerHead.id)}
                                                            title="Delete"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                <div className="table-pagination">
                                    Showing {filteredLedgerHeads.length} of {ledgerHeads.length} ledger heads
                                </div>
                            </>
                        )}
                    </div>

                    <div className="summary-section">
                        <h3><FaChartBar /> Financial Summary</h3>
                        <div className="summary-stats">
                            <div className="stat-item">
                                <div className="stat-label">Total Ledger Heads</div>
                                <div className="stat-value">{ledgerHeads.length}</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Debit Heads</div>
                                <div className="stat-value">{totalDebitHeads}</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Credit Heads</div>
                                <div className="stat-value">{totalCreditHeads}</div>
                            </div>
                            <div className="stat-item total-balance">
                                <div className="stat-label">Net Balance</div>
                                <div className={`stat-value ${totalDebitBalance - totalCreditBalance >= 0 ? 'positive' : 'negative'}`}>
                                    {formatCurrency(totalDebitBalance - totalCreditBalance)}
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label"><FaMoneyBillWave className="mr-1" /> Cash Balance</div>
                                <div className="stat-value cash-total">{formatCurrency(totalCashBalance)}</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label"><FaUniversity className="mr-1" /> Bank Balance</div>
                                <div className="stat-value bank-total">{formatCurrency(totalBankBalance)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="modal-backdrop">
                    <div className="form-container">
                        <form onSubmit={handleSubmit} className="ledger-head-form">
                            <h2>
                                {formMode === 'add' ? 'Add New Ledger Head' : 'Edit Ledger Head'}
                                <button type="button" className="close-form" onClick={() => setShowForm(false)}>×</button>
                            </h2>

                            <div className="form-grid">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="account_id">
                                            Account <span className="required">*</span>
                                        </label>
                                        <div className="select-wrapper">
                                            <select
                                                id="account_id"
                                                name="account_id"
                                                value={formData.account_id}
                                                onChange={handleInputChange}
                                                required
                                                className="enhanced-select"
                                            >
                                                <option value="">Select Account</option>
                                                {accounts.map(account => (
                                                    <option key={account.id} value={account.id}>
                                                        {account.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <FaAngleDown className="select-arrow" />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="name">
                                            Ledger Head Name <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Enter ledger head name"
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>
                                        Head Type <span className="required">*</span>
                                    </label>
                                    <div className="radio-group">
                                        <label className={`radio-label ${formData.head_type === 'debit' ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="head_type"
                                                value="debit"
                                                checked={formData.head_type === 'debit'}
                                                onChange={handleInputChange}
                                            />
                                            <span className="radio-button"></span>
                                            Debit
                                        </label>
                                        <label className={`radio-label ${formData.head_type === 'credit' ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="head_type"
                                                value="credit"
                                                checked={formData.head_type === 'credit'}
                                                onChange={handleInputChange}
                                            />
                                            <span className="radio-button"></span>
                                            Credit
                                        </label>
                                    </div>
                                </div>

                                <hr className="form-divider" />

                                <div className="form-group">
                                    <label htmlFor="current_balance">Total Balance</label>
                                    <input
                                        type="number"
                                        id="current_balance"
                                        name="current_balance"
                                        value={formData.current_balance}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        placeholder="0.00"
                                        readOnly={formMode === 'edit'}
                                        className="form-input"
                                    />
                                    {formMode === 'edit' &&
                                        <small className="help-text">Total balance is the sum of Cash and Bank balances</small>}
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="cash_balance">
                                            <FaMoneyBillWave className="icon-label" /> Cash Balance
                                        </label>
                                        <input
                                            type="number"
                                            id="cash_balance"
                                            name="cash_balance"
                                            value={formData.cash_balance}
                                            onChange={handleInputChange}
                                            step="0.01"
                                            placeholder="0.00"
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="bank_balance">
                                            <FaUniversity className="icon-label" /> Bank Balance
                                        </label>
                                        <input
                                            type="number"
                                            id="bank_balance"
                                            name="bank_balance"
                                            value={formData.bank_balance}
                                            onChange={handleInputChange}
                                            step="0.01"
                                            placeholder="0.00"
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-group description-group">
                                    <label htmlFor="description">Description</label>
                                    <textarea
                                        id="description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        rows="2"
                                        placeholder="Enter description (optional)"
                                        className="form-textarea"
                                    ></textarea>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-submit">
                                    {formMode === 'add' ? 'Add Ledger Head' : 'Update Ledger Head'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowForm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .ledger-heads-page {
                    padding: 20px;
                    max-width: 100%;
                    background-color: #fff;
                    min-height: 100vh;
                }
                
                .content-wrapper {
                    border: 1px solid #e2e8f0;
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 20px;
                    background-color: #fff;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
                }
                
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                
                .page-header h1 {
                    font-size: 1.75rem;
                    color: #1a202c;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .btn-add {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background-color: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
                }
                
                .btn-add:hover {
                    background-color: #4f46e5;
                    transform: translateY(-1px);
                    box-shadow: 0 3px 6px rgba(99, 102, 241, 0.3);
                }
                
                .filters-container {
                    margin-bottom: 20px;
                }
                
                .filters-bar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 24px;
                    padding: 20px;
                    background-color: #fff;
                    border-radius: 10px;
                    border: 1px solid #edf2f7;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
                    margin-bottom: 24px;
                }
                
                .filter-group {
                    display: flex;
                    align-items: center;
                    flex-grow: 1;
                    max-width: 300px;
                }
                
                .filter-group label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-right: 12px;
                    color: #4b5563;
                    font-weight: 500;
                    white-space: nowrap;
                }
                
                .select-container {
                    position: relative;
                    flex-grow: 1;
                }
                
                .filter-select {
                    appearance: none;
                    width: 100%;
                    padding: 10px 36px 10px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background-color: white;
                    font-size: 0.95rem;
                    color: #1a202c;
                    cursor: pointer;
                    transition: all 0.2s;
                    height: 42px;
                }
                
                .filter-select:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
                }
                
                .filter-select:hover {
                    border-color: #cbd5e1;
                }
                
                .select-arrow {
                    position: absolute;
                    top: 50%;
                    right: 12px;
                    transform: translateY(-50%);
                    color: #6b7280;
                    pointer-events: none;
                    font-size: 0.9rem;
                }
                
                .search-group {
                    flex-grow: 1;
                }
                
                .search-input-wrapper {
                    position: relative;
                    max-width: 400px;
                }
                
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #6b7280;
                }
                
                .search-input {
                    width: 100%;
                    padding: 10px 36px 10px 36px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    background-color: #fff;
                    color: #1f2937;
                    transition: all 0.2s;
                    height: 42px;
                }
                
                .search-input:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
                }
                
                .content-card {
                    background-color: white;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                    border: 1px solid #edf2f7;
                    margin: 20px 0;
                }
                
                .table-container {
                    overflow-x: auto;
                    width: 100%;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                    margin-bottom: 20px;
                }
                
                .ledger-heads-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 0.95rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                    table-layout: fixed;
                }
                
                .ledger-heads-table th {
                    text-align: left;
                    padding: 14px 20px;
                    background-color: #f8fafc;
                    color: #4b5563;
                    font-weight: 600;
                    border-bottom: 1px solid #e2e8f0;
                    white-space: nowrap;
                }
                
                .ledger-heads-table td {
                    padding: 16px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    color: #1f2937;
                    vertical-align: middle;
                }
                
                .ledger-heads-table th:nth-child(1),
                .ledger-heads-table td:nth-child(1) {
                    width: 18%;
                    padding-left: 24px;
                }
                
                .ledger-heads-table th:nth-child(2),
                .ledger-heads-table td:nth-child(2) {
                    width: 18%;
                }
                
                .ledger-heads-table th:nth-child(3),
                .ledger-heads-table td:nth-child(3) {
                    width: 10%;
                    text-align: center;
                }
                
                .ledger-heads-table th:nth-child(4),
                .ledger-heads-table td:nth-child(4) {
                    width: 10%;
                    text-align: right;
                }
                
                .ledger-heads-table th:nth-child(5),
                .ledger-heads-table td:nth-child(5) {
                    width: 10%;
                    text-align: center;
                }
                
                .ledger-heads-table th:nth-child(6),
                .ledger-heads-table td:nth-child(6) {
                    width: 10%;
                    text-align: center;
                }
                
                .ledger-heads-table th:nth-child(7),
                .ledger-heads-table td:nth-child(7) {
                    width: 14%;
                }
                
                .ledger-heads-table th:nth-child(8),
                .ledger-heads-table td:nth-child(8) {
                    width: 10%;
                    text-align: center;
                }
                
                .balance {
                    text-align: right;
                    font-family: 'Roboto Mono', 'Courier New', monospace;
                    font-weight: 500;
                }
                
                .type-badge, .cash-badge, .bank-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    text-align: center;
                    min-width: 80px;
                    height: 28px;
                }
                
                .type-badge {
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    text-transform: capitalize;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .type-badge.debit {
                    background-color: #fed7d7;
                    color: #b91c1c;
                }
                
                .type-badge.credit {
                    background-color: #b3e6c9;
                    color: #047857;
                }
                
                .cash-badge {
                    background-color: #fde68a;
                    color: #92400e;
                }
                
                .bank-badge {
                    background-color: #c7d2fe;
                    color: #3730a3;
                }
                
                .description {
                    max-width: 200px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: #6b7280;
                }
                
                .actions {
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                }
                
                .btn-edit, .btn-delete {
                    background: none;
                    border: none;
                    cursor: pointer;
                    width: 34px;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                
                .btn-edit {
                    color: #6366f1;
                }
                
                .btn-edit:hover {
                    background-color: #e0e7ff;
                }
                
                .btn-delete {
                    color: #ef4444;
                }
                
                .btn-delete:hover {
                    background-color: #fee2e2;
                }
                
                .no-data {
                    text-align: center;
                    padding: 40px !important;
                    color: #6b7280;
                    font-style: italic;
                }
                
                .table-pagination {
                    padding: 14px 20px;
                    background-color: #f8fafc;
                    color: #6b7280;
                    font-size: 0.875rem;
                    border-top: 1px solid #e2e8f0;
                    text-align: right;
                }
                
                .summary-section {
                    padding: 28px 24px;
                    background-color: white;
                    border-top: 1px solid #edf2f7;
                }
                
                .summary-section h3 {
                    color: #4a5568;
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin-top: 0;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .summary-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }
                
                .stat-item {
                    background-color: #fff;
                    border: 1px solid #edf2f7;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    transition: all 0.2s;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
                }
                
                .stat-item:nth-child(1), .stat-item:nth-child(2), .stat-item:nth-child(3) {
                    background-color: #fff;
                }
                
                .stat-item:nth-child(4) {
                    background-color: #f0f9ff;
                }
                
                .stat-item:nth-child(5) {
                    background-color: #fff;
                }
                
                .stat-item:nth-child(6) {
                    background-color: #fff;
                }
                
                .stat-label {
                    color: #6b7280;
                    font-size: 0.95rem;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                
                .stat-value {
                    font-size: 1.85rem;
                    font-weight: 600;
                    color: #1f2937;
                    line-height: 1.2;
                }
                
                .total-balance {
                    background-color: #f0f9ff;
                }
                
                .stat-value.positive {
                    color: #15803d;
                }
                
                .stat-value.negative {
                    color: #b91c1c;
                }
                
                .cash-total {
                    color: #92400e;
                }
                
                .bank-total {
                    color: #3730a3;
                }
                
                .error-message {
                    background-color: #fee2e2;
                    border-left: 4px solid #ef4444;
                    color: #b91c1c;
                    padding: 14px 16px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 8px;
                }
                
                .btn-retry {
                    padding: 6px 12px;
                    background-color: white;
                    color: #b91c1c;
                    border: 1px solid #fecaca;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                
                .btn-retry:hover {
                    background-color: #fef2f2;
                }
                
                .loading {
                    padding: 40px;
                    text-align: center;
                    color: #6b7280;
                    font-style: italic;
                }

                .form-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                
                .form-divider {
                    height: 1px;
                    background-color: #f0f0f0;
                    border: none;
                    margin: 2px 0 8px;
                }
                
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 0;
                }
                
                .form-group {
                    margin-bottom: 16px;
                }
                
                .form-group:last-child {
                    margin-bottom: 0;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    color: #374151;
                    font-weight: 500;
                    font-size: 0.95rem;
                }
                
                .icon-label {
                    margin-right: 6px;
                    color: #4f46e5;
                }
                
                .required {
                    color: #e53e3e;
                    margin-left: 3px;
                    font-weight: bold;
                }
                
                .form-input, .enhanced-select, .form-textarea {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #cbd5e0;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    color: #111827;
                    background-color: white !important;
                    transition: all 0.2s;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    font-weight: 500;
                }
                
                .enhanced-select {
                    appearance: none;
                    padding-right: 30px;
                    cursor: pointer;
                    height: 42px;
                }
                
                .select-arrow {
                    position: absolute;
                    top: 50%;
                    right: 12px;
                    transform: translateY(-50%);
                    color: #4b5563;
                    pointer-events: none;
                    font-size: 1rem;
                }
                
                .form-input {
                    height: 42px;
                }
                
                .form-input[type="number"] {
                    appearance: none;
                    -moz-appearance: textfield;
                }
                
                .form-input[type="number"]::-webkit-outer-spin-button,
                .form-input[type="number"]::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                
                .form-input:focus, 
                .form-textarea:focus, 
                .enhanced-select:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
                }
                
                .form-input::placeholder, .form-textarea::placeholder {
                    color: #7c8495;
                    opacity: 0.8;
                }
                
                .form-input[readonly] {
                    background-color: #f8fafc;
                    border-color: #e2e8f0;
                    cursor: not-allowed;
                }
                
                .select-wrapper {
                    position: relative;
                }
                
                .radio-group {
                    display: flex;
                    gap: 30px;
                    margin-top: 8px;
                    background-color: #f9fafb;
                    padding: 10px 12px;
                    border-radius: 8px;
                    border: 1px solid #e5e7eb;
                }
                
                .radio-label {
                    position: relative;
                    padding-left: 30px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    font-size: 1rem;
                    color: #374151;
                    transition: color 0.2s;
                    padding-top: 2px;
                    padding-bottom: 2px;
                    font-weight: 500;
                }
                
                .radio-button {
                    position: absolute;
                    left: 0;
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    border: 2px solid #9ca3af;
                    background-color: white;
                    transition: all 0.2s;
                }
                
                .radio-label input {
                    position: absolute;
                    opacity: 0;
                }
                
                .radio-label:hover .radio-button {
                    border-color: #4f46e5;
                }
                
                .radio-label input:checked ~ .radio-button {
                    border-color: #4f46e5;
                    border-width: 2px;
                }
                
                .radio-label input:checked ~ .radio-button:after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background-color: #4f46e5;
                }
                
                .radio-label.selected {
                    color: #4f46e5;
                    font-weight: 600;
                }
                
                .help-text {
                    display: block;
                    margin-top: 6px;
                    color: #4b5563;
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                
                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 20px;
                    padding-top: 16px;
                    border-top: 1px solid #f0f0f0;
                }
                
                .btn-submit {
                    padding: 10px 24px;
                    background-color: #4f46e5;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
                }
                
                .btn-submit:hover {
                    background-color: #4338ca;
                    transform: translateY(-1px);
                    box-shadow: 0 3px 6px rgba(79, 70, 229, 0.3);
                }
                
                .btn-submit:active {
                    transform: translateY(0);
                    box-shadow: 0 1px 3px rgba(79, 70, 229, 0.2);
                }
                
                .btn-cancel {
                    padding: 10px 24px;
                    background-color: #f9fafb;
                    color: #374151;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .btn-cancel:hover {
                    background-color: #f3f4f6;
                    border-color: #d1d5db;
                }
                
                @media (max-width: 768px) {
                    .filters-bar {
                        flex-direction: column;
                        gap: 16px;
                    }
                    
                    .filter-group {
                        max-width: 100%;
                    }
                    
                    .summary-stats {
                        grid-template-columns: 1fr 1fr;
                    }
                    
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }
                
                @media (max-width: 640px) {
                    .form-container {
                        padding: 20px;
                        max-width: 95%;
                        margin: 10px;
                        max-height: 95vh;
                    }
                    
                    .form-input, .enhanced-select, .form-textarea {
                        font-size: 16px; /* Prevents iOS zoom on input focus */
                    }
                    
                    .summary-stats {
                        grid-template-columns: 1fr;
                    }
                    
                    .actions {
                        flex-direction: column;
                        gap: 8px;
                    }
                }

                @media (min-width: 768px) {
                    .ledger-heads-page {
                        padding: 30px;
                    }
                    
                    .content-card {
                        border: 1px solid #e2e8f0;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                    }
                }

                .ledger-heads-table tbody tr,
                .ledger-heads-table tbody tr.ledger-row {
                    background-color: #ffffff;
                    transition: background-color 0.15s ease;
                }
                
                .ledger-heads-table tbody tr:hover,
                .ledger-heads-table tbody tr.ledger-row:hover {
                    background-color: #f9fafb !important;
                }
                
                .ledger-row {
                    border-bottom: 1px solid #f0f0f0;
                }
                
                .ledger-heads-table tbody tr:last-child,
                .ledger-heads-table tbody tr.ledger-row:last-child {
                    border-bottom: none;
                }
                
                .type-badge.credit {
                    background-color: #b3e6c9;
                    color: #047857;
                }
                
                .type-badge.debit {
                    background-color: #fed7d7;
                    color: #b91c1c;
                }

                .btn-clear-filter {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                
                .btn-clear-filter:hover {
                    color: #6b7280;
                    background-color: #f3f4f6;
                }
                
                .form-textarea {
                    height: auto;
                    min-height: 70px;
                    resize: vertical;
                    padding-top: 10px;
                    line-height: 1.5;
                }

                .modal-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 50;
                    backdrop-filter: blur(4px);
                }
                
                .form-container {
                    background-color: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    width: 100%;
                    max-width: 680px;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 24px 28px;
                    animation: fadeIn 0.3s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .ledger-head-form h2 {
                    color: #111827;
                    font-size: 1.6rem;
                    margin-top: 0;
                    margin-bottom: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #e5e7eb;
                    font-weight: 700;
                }
                
                .close-form {
                    background-color: #f3f4f6;
                    border: none;
                    color: #4b5563;
                    font-size: 1.4rem;
                    cursor: pointer;
                    padding: 2px 10px;
                    line-height: 1;
                    transition: all 0.2s;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .close-form:hover {
                    background-color: #e5e7eb;
                    color: #1f2937;
                }
            `}</style>
        </div>
    );
} 