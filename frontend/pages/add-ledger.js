import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import API_CONFIG from '../config';
import {
    FaTag, FaMoneyBillWave, FaUniversity,
    FaAngleDown, FaArrowLeft, FaSave, FaTimes
} from 'react-icons/fa';

export default function AddLedger() {
    const router = useRouter();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        account_id: '',
        name: '',
        head_type: 'debit',
        current_balance: 0,
        cash_balance: 0,
        bank_balance: 0,
        description: ''
    });

    // Fetch all accounts for dropdown
    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_CONFIG.BASE_URL}/accounts`);

                if (response.data && response.data.data) {
                    setAccounts(response.data.data);

                    // Set first account as default if available
                    if (response.data.data.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            account_id: response.data.data[0].id
                        }));
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error('Error fetching accounts:', err);
                setError('Failed to load accounts. Please try again later.');
                setLoading(false);
            }
        };

        fetchAccounts();
    }, []);

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
                setFormData(prev => ({
                    ...prev,
                    current_balance: newBalance,
                    cash_balance: newBalance
                }));
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

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);
            setSuccess(false);

            const response = await axios.post(`${API_CONFIG.BASE_URL}/ledger-heads`, formData);

            if (response.data && response.data.success) {
                setSuccess(true);
                // Reset form
                setFormData({
                    account_id: accounts.length > 0 ? accounts[0].id : '',
                    name: '',
                    head_type: 'debit',
                    current_balance: 0,
                    cash_balance: 0,
                    bank_balance: 0,
                    description: ''
                });

                // Redirect to manage ledger page after 1.5 seconds
                setTimeout(() => {
                    router.push('/manage-ledger');
                }, 1500);
            }
        } catch (err) {
            console.error('Error creating ledger head:', err);
            if (err.response && err.response.data && err.response.data.message) {
                setError(err.response.data.message);
            } else {
                setError('Failed to create ledger head. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ledger-heads-page">
            <div className="page-header">
                <h1><FaTag /> Add New Ledger Head</h1>
                <button
                    className="btn-secondary"
                    onClick={() => router.push('/manage-ledger')}
                >
                    <FaArrowLeft /> Back to Manage Ledger
                </button>
            </div>
            
            <div className="form-container-standalone">
                {error && (
                    <div className="error-message">
                        <FaTimes className="icon-error" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        Ledger head created successfully! Redirecting...
                    </div>
                )}

                <form onSubmit={handleSubmit} className="ledger-head-form">
                    <div className="form-section">
                        <h3>Basic Information</h3>

                        <div className="form-group">
                            <label htmlFor="account_id">Account <span className="required">*</span></label>
                            <div className="select-wrapper">
                                <select
                                    id="account_id"
                                    name="account_id"
                                    className="enhanced-select"
                                    value={formData.account_id}
                                    onChange={handleInputChange}
                                    required
                                    disabled={loading}
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
                            <label htmlFor="name">Ledger Head Name <span className="required">*</span></label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                                disabled={loading}
                                placeholder="Enter ledger head name"
                                className="form-control"
                            />
                        </div>

                        <div className="form-group">
                            <label>Head Type <span className="required">*</span></label>
                            <div className="radio-group">
                                <label className={`radio-label ${formData.head_type === 'debit' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="head_type"
                                        value="debit"
                                        checked={formData.head_type === 'debit'}
                                        onChange={handleInputChange}
                                        disabled={loading}
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
                                        disabled={loading}
                                    />
                                    <span className="radio-button"></span>
                                    Credit
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Balance Information</h3>

                        <div className="form-group">
                            <label htmlFor="current_balance">Total Balance</label>
                            <input
                                type="number"
                                id="current_balance"
                                name="current_balance"
                                value={formData.current_balance}
                                onChange={handleInputChange}
                                step="0.01"
                                disabled={loading}
                                placeholder="0.00"
                                className="form-control"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="cash_balance">
                                    <FaMoneyBillWave className="mr-1" /> Cash Balance
                                </label>
                                <input
                                    type="number"
                                    id="cash_balance"
                                    name="cash_balance"
                                    value={formData.cash_balance}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    disabled={loading}
                                    placeholder="0.00"
                                    className="form-control"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="bank_balance">
                                    <FaUniversity className="mr-1" /> Bank Balance
                                </label>
                                <input
                                    type="number"
                                    id="bank_balance"
                                    name="bank_balance"
                                    value={formData.bank_balance}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    disabled={loading}
                                    placeholder="0.00"
                                    className="form-control"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description (Optional)</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                disabled={loading}
                                rows="3"
                                placeholder="Enter description (optional)"
                                className="form-control"
                            ></textarea>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading}
                        >
                            <FaSave className="icon-left" />
                            {loading ? 'Creating...' : 'Create Ledger Head'}
                        </button>

                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => router.push('/manage-ledger')}
                            disabled={loading}
                        >
                            <FaTimes className="icon-left" />
                            Cancel
                        </button>
                </div>
                </form>
            </div>

            <style jsx>{`
                .form-container-standalone {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    padding: 25px;
                    margin-bottom: 30px;
                }
                
                .form-section {
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #eaeaea;
                }
                
                .form-section h3 {
                    color: #333;
                    font-size: 1.2rem;
                    margin-bottom: 20px;
                    position: relative;
                    padding-left: 15px;
                }
                
                .form-section h3:before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    height: 100%;
                    width: 4px;
                    background: #6366f1;
                    border-radius: 2px;
                }
                
                .error-message {
                    background-color: #fee2e2;
                    border-left: 4px solid #ef4444;
                    color: #b91c1c;
                    padding: 12px 15px;
                    margin-bottom: 20px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    animation: fadeIn 0.3s ease-out;
                }
                
                .success-message {
                    background-color: #dcfce7;
                    border-left: 4px solid #22c55e;
                    color: #166534;
                    padding: 12px 15px;
                    margin-bottom: 20px;
                    border-radius: 4px;
                    animation: fadeIn 0.3s ease-out;
                }
                
                .icon-error {
                    margin-right: 10px;
                    font-size: 16px;
                }
                
                .icon-left {
                    margin-right: 8px;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: #374151;
                }
                
                .form-control {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 15px;
                    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
                }
                
                .form-control:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                    outline: none;
                }
                
                .required {
                    color: #ef4444;
                }
                
                .select-wrapper {
                    position: relative;
                }
                
                .enhanced-select {
                    appearance: none;
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 15px;
                    background-color: white;
                    cursor: pointer;
                }
                
                .enhanced-select:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                    outline: none;
                }
                
                .select-arrow {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #6b7280;
                    pointer-events: none;
                }
                
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                
                .radio-group {
                    display: flex;
                    gap: 20px;
                }
                
                .radio-label {
                    display: flex;
                    align-items: center;
                    position: relative;
                    padding-left: 28px;
                    cursor: pointer;
                    font-size: 15px;
                    user-select: none;
                }
                
                .radio-label input {
                    position: absolute;
                    opacity: 0;
                    cursor: pointer;
                }
                
                .radio-button {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 20px;
                    width: 20px;
                    background-color: #fff;
                    border: 2px solid #d1d5db;
                    border-radius: 50%;
                }
                
                .radio-label:hover input ~ .radio-button {
                    border-color: #6366f1;
                }
                
                .radio-label input:checked ~ .radio-button {
                    border-color: #6366f1;
                }
                
                .radio-button:after {
                    content: "";
                    position: absolute;
                    display: none;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #6366f1;
                }
                
                .radio-label input:checked ~ .radio-button:after {
                    display: block;
                }
                
                .radio-label.selected {
                    font-weight: 500;
                    color: #4f46e5;
                }
                
                .form-actions {
                    display: flex;
                    gap: 15px;
                    margin-top: 30px;
                }
                
                .btn-submit {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px 20px;
                    background-color: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .btn-submit:hover {
                    background-color: #4f46e5;
                }
                
                .btn-submit:disabled {
                    background-color: #9ca3af;
                    cursor: not-allowed;
                }
                
                .btn-cancel {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px 20px;
                    background-color: white;
                    color: #4b5563;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s, border-color 0.2s;
                }
                
                .btn-cancel:hover {
                    background-color: #f9fafb;
                    border-color: #9ca3af;
                }
                
                .btn-cancel:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @media (max-width: 768px) {
                    .form-row {
                        grid-template-columns: 1fr;
                        gap: 15px;
                    }
                    
                    .form-actions {
                        flex-direction: column;
                    }
                    
                    .btn-submit, .btn-cancel {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
} 