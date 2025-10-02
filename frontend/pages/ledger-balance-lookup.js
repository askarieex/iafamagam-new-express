import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import LoadingSpinner from '../components/LoadingSpinner';
import axios from 'axios';
import API_CONFIG from '../config';

const LedgerBalanceLookup = () => {
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [selectedLedgerHead, setSelectedLedgerHead] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [balanceData, setBalanceData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Configure axios with default options
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch ledger heads when account changes
    useEffect(() => {
        if (selectedAccount) {
            fetchLedgerHeads();
        } else {
            setLedgerHeads([]);
            setSelectedLedgerHead('');
        }
    }, [selectedAccount]);

    const fetchAccounts = async () => {
        try {
            console.log('Fetching accounts...');
            const response = await api.get('/api/accounts');
            console.log('Accounts response:', response.data);

            if (response.data && response.data.data) {
                setAccounts(response.data.data);
                console.log('Set accounts:', response.data.data);
            } else {
                setAccounts([]);
                console.warn('Unexpected API response format:', response.data);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);

            if (error.response && error.response.data && error.response.data.message) {
                setError(`Failed to fetch accounts: ${error.response.data.message}`);
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else {
                setError(`Failed to fetch accounts: ${error.message}`);
            }
        }
    };

    const fetchLedgerHeads = async () => {
        try {
            const response = await api.get(`/api/ledger-heads?account_id=${selectedAccount}`);
            if (response.data && response.data.data) {
                setLedgerHeads(response.data.data);
            } else {
                setLedgerHeads([]);
            }
        } catch (error) {
            console.error('Error fetching ledger heads:', error);
            setLedgerHeads([]);
        }
    };

    const fetchLedgerBalance = async () => {
        if (!selectedAccount || !selectedLedgerHead || !selectedDate) {
            setError('Please select account, ledger head, and date');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.get(
                `/api/reports/ledger-balance/${selectedAccount}/${selectedLedgerHead}?date=${selectedDate}`
            );

            if (response.data && response.data.data) {
                setBalanceData(response.data.data);
            } else {
                setError('No balance data received');
            }
        } catch (error) {
            console.error('Error fetching balance data:', error);

            if (error.response && error.response.data && error.response.data.message) {
                setError(`Failed to fetch balance data: ${error.response.data.message}`);
            } else {
                setError('Error fetching balance data');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <>
            <Head>
                <title>Ledger Balance Lookup - IAFA Software</title>
            </Head>

            <div className="container-fluid py-4">
                <div className="row justify-content-center">
                    <div className="col-lg-8">
                        <div className="card">
                            <div className="card-header pb-0">
                                <div className="d-flex align-items-center">
                                    <div>
                                        <h6>🔍 Ledger Balance Lookup</h6>
                                        <p className="text-sm mb-0">
                                            Get balance information for any ledger head on a specific date
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body">
                                {/* Selection Form */}
                                <div className="row g-3 mb-4">
                                    <div className="col-md-4">
                                        <label className="form-label">Account</label>
                                        <select
                                            className="form-select"
                                            value={selectedAccount}
                                            onChange={(e) => setSelectedAccount(e.target.value)}
                                        >
                                            <option value="">Select Account</option>
                                            {accounts.map(account => (
                                                <option key={account.id} value={account.id}>
                                                    {account.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Ledger Head</label>
                                        <select
                                            className="form-select"
                                            value={selectedLedgerHead}
                                            onChange={(e) => setSelectedLedgerHead(e.target.value)}
                                            disabled={!selectedAccount}
                                        >
                                            <option value="">Select Ledger Head</option>
                                            {ledgerHeads.map(ledger => (
                                                <option key={ledger.id} value={ledger.id}>
                                                    {ledger.name} ({ledger.head_type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Search Button */}
                                <div className="d-flex justify-content-center mb-4">
                                    <button
                                        className="btn btn-primary px-5"
                                        onClick={fetchLedgerBalance}
                                        disabled={loading || !selectedAccount || !selectedLedgerHead}
                                    >
                                        {loading ? (
                                            <>
                                                <LoadingSpinner size="sm" color="white" />
                                                <span className="ms-2">Loading...</span>
                                            </>
                                        ) : (
                                            'Get Balance'
                                        )}
                                    </button>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="alert alert-danger">
                                        {error}
                                    </div>
                                )}

                                {/* Balance Results */}
                                {balanceData && (
                                    <div className="mt-4">
                                        <div className="card">
                                            <div className="card-header pb-0">
                                                <h6>📊 Ledger Balance Information</h6>
                                            </div>
                                            <div className="card-body">
                                                <div className="table-responsive">
                                                    <table className="table table-striped">
                                                        <tbody>
                                                            <tr>
                                                                <td><strong>Ledger Name</strong></td>
                                                                <td>{balanceData.ledger_head.name}</td>
                                                            </tr>
                                                            <tr>
                                                                <td><strong>Type</strong></td>
                                                                <td>
                                                                    <span className={`badge ${balanceData.ledger_head.head_type === 'credit' ? 'bg-success' : 'bg-warning'}`}>
                                                                        {balanceData.ledger_head.head_type}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td><strong>Account</strong></td>
                                                                <td>{balanceData.account_name}</td>
                                                            </tr>
                                                            <tr>
                                                                <td><strong>Date</strong></td>
                                                                <td>{formatDate(balanceData.date)}</td>
                                                            </tr>
                                                            <tr className="table-primary">
                                                                <td><strong>💰 Total Balance</strong></td>
                                                                <td><strong className="h5 text-primary">{formatCurrency(balanceData.balance)}</strong></td>
                                                            </tr>
                                                            <tr>
                                                                <td><strong>Cash Balance</strong></td>
                                                                <td className="text-success">{formatCurrency(balanceData.cash_balance)}</td>
                                                            </tr>
                                                            <tr>
                                                                <td><strong>Bank Balance</strong></td>
                                                                <td className="text-info">{formatCurrency(balanceData.bank_balance)}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Transaction Summary */}
                                                {balanceData.transaction_summary && (
                                                    <>
                                                        <hr className="mt-4 mb-3" />
                                                        <h6 className="mb-3">📈 Transaction Summary (Up to this date)</h6>
                                                        <div className="table-responsive">
                                                            <table className="table table-bordered">
                                                                <tbody>
                                                                    <tr>
                                                                        <td><strong>Total Credits</strong></td>
                                                                        <td className="text-success fw-bold">{formatCurrency(balanceData.transaction_summary.total_credits)}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td><strong>Total Debits</strong></td>
                                                                        <td className="text-danger fw-bold">{formatCurrency(balanceData.transaction_summary.total_debits)}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td><strong>Transaction Count</strong></td>
                                                                        <td className="text-info fw-bold">{balanceData.transaction_summary.transaction_count}</td>
                                                                    </tr>
                                                                    <tr className="table-warning">
                                                                        <td><strong>Net Change</strong></td>
                                                                        <td className="fw-bold">{formatCurrency(balanceData.transaction_summary.net_change)}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* No Data Message */}
                                {balanceData === null && !loading && !error && (
                                    <div className="text-center py-5 text-muted">
                                        <div className="h1">📊</div>
                                        <p>Select account, ledger head, and date to view balance information</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LedgerBalanceLookup;