import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaEdit, FaTrash, FaSync, FaUniversity } from 'react-icons/fa';
import API_CONFIG from '../config';

export default function AccountsPage() {
    const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' or 'bankAccounts'
    const [accounts, setAccounts] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state for adding/editing accounts
    const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
    const [currentAccount, setCurrentAccount] = useState(null);
    const [showForm, setShowForm] = useState(false);

    // Form data for regular accounts
    const [accountFormData, setAccountFormData] = useState({
        name: '',
        opening_balance: 0,
        cash_balance: 0,
        bank_balance: 0
    });

    // Form data for bank accounts
    const [bankAccountFormData, setBankAccountFormData] = useState({
        bank_name: '',
        acc_number: '',
        ifsc: '',
        bank_balance: 0
    });

    // Configure axios with default options
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch all accounts
    const fetchAccounts = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get('/api/accounts');

            if (response.data && response.data.data) {
                setAccounts(response.data.data);
            } else {
                setAccounts([]);
                console.warn('Unexpected API response format:', response.data);
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);

            // Provide a more specific error message
            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                setError(`Failed to fetch accounts. Server responded with: ${err.response.status} ${err.response.statusText}`);
            } else {
                setError(`Failed to fetch accounts: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch all bank accounts
    const fetchBankAccounts = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get('/api/bank-accounts');

            if (response.data && response.data.data) {
                setBankAccounts(response.data.data);
            } else {
                setBankAccounts([]);
                console.warn('Unexpected API response format:', response.data);
            }
        } catch (err) {
            console.error('Error fetching bank accounts:', err);

            // Provide a more specific error message
            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                setError(`Failed to fetch bank accounts. Server responded with: ${err.response.status} ${err.response.statusText}`);
            } else {
                setError(`Failed to fetch bank accounts: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Retry connection
    const retryConnection = () => {
        if (activeTab === 'accounts') {
            fetchAccounts();
        } else {
            fetchBankAccounts();
        }
    };

    // Load data on component mount and when tab changes
    useEffect(() => {
        if (activeTab === 'accounts') {
            fetchAccounts();
        } else {
            fetchBankAccounts();
        }
    }, [activeTab]);

    // Handle tab change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setShowForm(false);
        setError(null);
    };

    // Handle form input changes for regular accounts
    const handleAccountInputChange = (e) => {
        const { name, value } = e.target;
        setAccountFormData({
            ...accountFormData,
            [name]: name.includes('balance') ? parseFloat(value) : value
        });
    };

    // Handle form input changes for bank accounts
    const handleBankAccountInputChange = (e) => {
        const { name, value } = e.target;
        setBankAccountFormData({
            ...bankAccountFormData,
            [name]: name === 'bank_balance' ? parseFloat(value) : value
        });
    };

    // Reset account form to initial state
    const resetAccountForm = () => {
        setAccountFormData({
            name: '',
            opening_balance: 0,
            cash_balance: 0,
            bank_balance: 0
        });
        setCurrentAccount(null);
        setFormMode('add');
    };

    // Reset bank account form to initial state
    const resetBankAccountForm = () => {
        setBankAccountFormData({
            bank_name: '',
            acc_number: '',
            ifsc: '',
            bank_balance: 0
        });
        setCurrentAccount(null);
        setFormMode('add');
    };

    // Open form for adding a new account or bank account
    const handleAddNew = () => {
        if (activeTab === 'accounts') {
            resetAccountForm();
        } else {
            resetBankAccountForm();
        }
        setFormMode('add');
        setShowForm(true);
    };

    // Open form for editing an existing account
    const handleEditAccount = (account) => {
        setAccountFormData({
            name: account.name,
            opening_balance: account.opening_balance,
            cash_balance: account.cash_balance,
            bank_balance: account.bank_balance
        });
        setCurrentAccount(account);
        setFormMode('edit');
        setShowForm(true);
    };

    // Open form for editing an existing bank account
    const handleEditBankAccount = (bankAccount) => {
        setBankAccountFormData({
            bank_name: bankAccount.bank_name,
            acc_number: bankAccount.acc_number,
            ifsc: bankAccount.ifsc || '',
            bank_balance: bankAccount.bank_balance
        });
        setCurrentAccount(bankAccount);
        setFormMode('edit');
        setShowForm(true);
    };

    // Handle account form submission
    const handleAccountSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);

            if (formMode === 'add') {
                // Create new account
                await api.post('/api/accounts', accountFormData);
            } else {
                // Update existing account
                await api.patch(`/api/accounts/${currentAccount.id}`, accountFormData);
            }

            // Refresh accounts list
            await fetchAccounts();

            // Reset and close form
            resetAccountForm();
            setShowForm(false);

        } catch (err) {
            console.error(`Error ${formMode === 'add' ? 'creating' : 'updating'} account:`, err);

            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to ${formMode} account: ${err.response.data.message}`);
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else {
                setError(`Failed to ${formMode} account: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle bank account form submission
    const handleBankAccountSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);

            if (formMode === 'add') {
                // Create new bank account
                await api.post('/api/bank-accounts', bankAccountFormData);
            } else {
                // Update existing bank account
                await api.patch(`/api/bank-accounts/${currentAccount.id}`, bankAccountFormData);
            }

            // Refresh bank accounts list
            await fetchBankAccounts();

            // Reset and close form
            resetBankAccountForm();
            setShowForm(false);

        } catch (err) {
            console.error(`Error ${formMode === 'add' ? 'creating' : 'updating'} bank account:`, err);

            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to ${formMode} bank account: ${err.response.data.message}`);
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else {
                setError(`Failed to ${formMode} bank account: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle account deletion
    const handleDeleteAccount = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await api.delete(`/api/accounts/${id}`);
            await fetchAccounts();
        } catch (err) {
            console.error('Error deleting account:', err);

            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to delete account: ${err.response.data.message}`);
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else {
                setError(`Failed to delete account: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle bank account deletion
    const handleDeleteBankAccount = async (id) => {
        if (!window.confirm('Are you sure you want to delete this bank account?')) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await api.delete(`/api/bank-accounts/${id}`);
            await fetchBankAccounts();
        } catch (err) {
            console.error('Error deleting bank account:', err);

            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to delete bank account: ${err.response.data.message}`);
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else {
                setError(`Failed to delete bank account: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Render account form
    const renderAccountForm = () => (
        <form onSubmit={handleAccountSubmit} className="account-form">
            <h2>{formMode === 'add' ? 'Add New Account' : 'Edit Account'}</h2>

            <div className="form-group">
                <label htmlFor="name">Account Name*</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={accountFormData.name}
                    onChange={handleAccountInputChange}
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="opening_balance">Opening Balance</label>
                <input
                    type="number"
                    id="opening_balance"
                    name="opening_balance"
                    value={accountFormData.opening_balance}
                    onChange={handleAccountInputChange}
                    step="0.01"
                />
            </div>

            <div className="form-group">
                <label htmlFor="cash_balance">Cash Balance</label>
                <input
                    type="number"
                    id="cash_balance"
                    name="cash_balance"
                    value={accountFormData.cash_balance}
                    onChange={handleAccountInputChange}
                    step="0.01"
                />
            </div>

            <div className="form-group">
                <label htmlFor="bank_balance">Bank Balance</label>
                <input
                    type="number"
                    id="bank_balance"
                    name="bank_balance"
                    value={accountFormData.bank_balance}
                    onChange={handleAccountInputChange}
                    step="0.01"
                />
            </div>

            <div className="form-actions">
                <button type="submit" className="btn-submit">
                    {formMode === 'add' ? 'Add Account' : 'Update Account'}
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
    );

    // Render bank account form
    const renderBankAccountForm = () => (
        <form onSubmit={handleBankAccountSubmit} className="account-form">
            <h2>{formMode === 'add' ? 'Add New Bank Account' : 'Edit Bank Account'}</h2>

            <div className="form-group">
                <label htmlFor="bank_name">Bank Name*</label>
                <input
                    type="text"
                    id="bank_name"
                    name="bank_name"
                    value={bankAccountFormData.bank_name}
                    onChange={handleBankAccountInputChange}
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="acc_number">Account Number*</label>
                <input
                    type="text"
                    id="acc_number"
                    name="acc_number"
                    value={bankAccountFormData.acc_number}
                    onChange={handleBankAccountInputChange}
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="ifsc">IFSC Code</label>
                <input
                    type="text"
                    id="ifsc"
                    name="ifsc"
                    value={bankAccountFormData.ifsc}
                    onChange={handleBankAccountInputChange}
                />
            </div>

            <div className="form-group">
                <label htmlFor="bank_balance">Bank Balance</label>
                <input
                    type="number"
                    id="bank_balance"
                    name="bank_balance"
                    value={bankAccountFormData.bank_balance}
                    onChange={handleBankAccountInputChange}
                    step="0.01"
                />
            </div>

            <div className="form-actions">
                <button type="submit" className="btn-submit">
                    {formMode === 'add' ? 'Add Bank Account' : 'Update Bank Account'}
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
    );

    return (
        <div className="accounts-page">
            <div className="page-header">
                <h1>Accounts Management</h1>
                <button
                    className="btn-add"
                    onClick={handleAddNew}
                >
                    <FaPlus /> Add New {activeTab === 'accounts' ? 'Account' : 'Bank Account'}
                </button>
            </div>

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'accounts' ? 'active' : ''}`}
                    onClick={() => handleTabChange('accounts')}
                >
                    Accounts
                </button>
                <button
                    className={`tab ${activeTab === 'bankAccounts' ? 'active' : ''}`}
                    onClick={() => handleTabChange('bankAccounts')}
                >
                    <FaUniversity /> Bank Accounts
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                    <button className="btn-retry" onClick={retryConnection}>
                        <FaSync /> Retry Connection
                    </button>
                </div>
            )}

            {showForm && (
                <div className="account-form-container">
                    {activeTab === 'accounts' ? renderAccountForm() : renderBankAccountForm()}
                </div>
            )}

            {activeTab === 'accounts' ? (
                <div className="accounts-table-container">
                    {loading && !showForm ? (
                        <div className="loading">Loading accounts...</div>
                    ) : (
                        <table className="accounts-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Opening Balance</th>
                                    <th>Closing Balance</th>
                                    <th>Cash Balance</th>
                                    <th>Bank Balance</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="no-data">No accounts found. Add your first account to get started.</td>
                                    </tr>
                                ) : (
                                    accounts.map(account => (
                                        <tr key={account.id}>
                                            <td>{account.name}</td>
                                            <td className="balance">{parseFloat(account.opening_balance).toFixed(2)}</td>
                                            <td className="balance">{parseFloat(account.closing_balance).toFixed(2)}</td>
                                            <td className="balance">{parseFloat(account.cash_balance).toFixed(2)}</td>
                                            <td className="balance">{parseFloat(account.bank_balance).toFixed(2)}</td>
                                            <td className="actions">
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => handleEditAccount(account)}
                                                    title="Edit Account"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDeleteAccount(account.id)}
                                                    title="Delete Account"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div className="accounts-table-container">
                    {loading && !showForm ? (
                        <div className="loading">Loading bank accounts...</div>
                    ) : (
                        <table className="accounts-table">
                            <thead>
                                <tr>
                                    <th>Bank Name</th>
                                    <th>Account Number</th>
                                    <th>IFSC Code</th>
                                    <th>Bank Balance</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bankAccounts.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="no-data">No bank accounts found. Add your first bank account to get started.</td>
                                    </tr>
                                ) : (
                                    bankAccounts.map(bankAccount => (
                                        <tr key={bankAccount.id}>
                                            <td>{bankAccount.bank_name}</td>
                                            <td>{bankAccount.acc_number}</td>
                                            <td>{bankAccount.ifsc || 'N/A'}</td>
                                            <td className="balance">{parseFloat(bankAccount.bank_balance).toFixed(2)}</td>
                                            <td className="actions">
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => handleEditBankAccount(bankAccount)}
                                                    title="Edit Bank Account"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDeleteBankAccount(bankAccount.id)}
                                                    title="Delete Bank Account"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
} 