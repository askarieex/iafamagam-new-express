import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import LoadingSpinner from '../components/LoadingSpinner';
import axios from 'axios';
import API_CONFIG from '../config';

const BalanceSnapshots = () => {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Configure axios with default options
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 10000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Generate months array
    const months = [
        { value: '01', label: 'January' },
        { value: '02', label: 'February' },
        { value: '03', label: 'March' },
        { value: '04', label: 'April' },
        { value: '05', label: 'May' },
        { value: '06', label: 'June' },
        { value: '07', label: 'July' },
        { value: '08', label: 'August' },
        { value: '09', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' }
    ];

    // Generate years array (current year and past 5 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

    useEffect(() => {
        fetchAccounts();
        // Set current month as default
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
        setSelectedMonth(currentMonth);
    }, []);

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/api/accounts');
            if (response.data && response.data.data) {
                setAccounts(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            setError('Failed to fetch accounts');
        }
    };

    const fetchSnapshots = async () => {
        if (!selectedAccount || !selectedMonth || !selectedYear) {
            setError('Please select account, month, and year');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.get(`/api/reports/monthly-snapshots/${selectedAccount}/${selectedYear}/${selectedMonth}`);

            if (response.data && response.data.data) {
                setSnapshots(response.data.data);
            } else {
                setSnapshots([]);
                setError('No snapshots found for the selected period');
            }
        } catch (error) {
            console.error('Error fetching snapshots:', error);
            setError('Error fetching balance snapshots');
            setSnapshots([]);
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
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <>
            <Head>
                <title>Balance Snapshots - IAFA Software</title>
            </Head>

            <div className="container-fluid py-4">
                <div className="row justify-content-center">
                    <div className="col-12">
                        <div className="card">
                            <div className="card-header pb-0">
                                <div className="d-flex align-items-center">
                                    <div>
                                        <h6>📊 Balance Snapshots Viewer</h6>
                                        <p className="text-sm mb-0">
                                            View monthly balance snapshots to check if they're updating correctly
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body">
                                {/* Filters */}
                                <div className="row g-3 mb-4">
                                    <div className="col-md-3">
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

                                    <div className="col-md-3">
                                        <label className="form-label">Year</label>
                                        <select
                                            className="form-select"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                        >
                                            {years.map(year => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-3">
                                        <label className="form-label">Month</label>
                                        <select
                                            className="form-select"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                        >
                                            <option value="">Select Month</option>
                                            {months.map(month => (
                                                <option key={month.value} value={month.value}>
                                                    {month.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-3">
                                        <label className="form-label">&nbsp;</label>
                                        <button
                                            className="btn btn-primary d-block w-100"
                                            onClick={fetchSnapshots}
                                            disabled={loading || !selectedAccount || !selectedMonth || !selectedYear}
                                        >
                                            {loading ? (
                                                <>
                                                    <LoadingSpinner size="sm" color="white" />
                                                    <span className="ms-2">Loading...</span>
                                                </>
                                            ) : (
                                                'View Snapshots'
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="alert alert-danger">
                                        {error}
                                    </div>
                                )}

                                {/* Results Table */}
                                {snapshots.length > 0 && (
                                    <div className="table-responsive">
                                        <table className="table table-striped">
                                            <thead>
                                                <tr>
                                                    <th>Ledger Head</th>
                                                    <th>Type</th>
                                                    <th>Opening Balance</th>
                                                    <th>Total Credits</th>
                                                    <th>Total Debits</th>
                                                    <th>Closing Balance</th>
                                                    <th>Cash Amount</th>
                                                    <th>Bank Amount</th>
                                                    <th>Last Updated</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {snapshots.map((snapshot, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            <strong>{snapshot.ledger_head?.name || 'Unknown'}</strong>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${
                                                                snapshot.ledger_head?.head_type === 'credit' ? 'bg-success' : 'bg-warning'
                                                            }`}>
                                                                {snapshot.ledger_head?.head_type || 'Unknown'}
                                                            </span>
                                                        </td>
                                                        <td>{formatCurrency(snapshot.opening_balance)}</td>
                                                        <td className="text-success">{formatCurrency(snapshot.total_credits)}</td>
                                                        <td className="text-danger">{formatCurrency(snapshot.total_debits)}</td>
                                                        <td>
                                                            <strong>{formatCurrency(snapshot.closing_balance)}</strong>
                                                        </td>
                                                        <td className="text-info">{formatCurrency(snapshot.cash_amount)}</td>
                                                        <td className="text-primary">{formatCurrency(snapshot.bank_amount)}</td>
                                                        <td>
                                                            <small className="text-muted">
                                                                {formatDate(snapshot.last_calculated_at || snapshot.updated_at)}
                                                            </small>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* No Data Message */}
                                {snapshots.length === 0 && !loading && !error && (
                                    <div className="text-center py-5 text-muted">
                                        <div className="h1">📊</div>
                                        <p>Select account, year, and month to view balance snapshots</p>
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

export default BalanceSnapshots;