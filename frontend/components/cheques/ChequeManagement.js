import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaCheck,
    FaTimes,
    FaFilter,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaInfoCircle,
    FaSyncAlt,
    FaFileInvoiceDollar
} from 'react-icons/fa';
import API_CONFIG from '../../config';
import { toast } from 'react-toastify';

// Inline styles for beautiful UI
const styles = {
    container: {
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '1rem'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem'
    },
    titleWrapper: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    },
    icon: {
        fontSize: '1.25rem',
        color: '#4f46e5'
    },
    title: {
        fontSize: '1.1rem',
        fontWeight: 'bold',
        margin: 0
    },
    actions: {
        display: 'flex',
        gap: '0.75rem'
    },
    buttonPrimary: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        backgroundColor: '#4f46e5',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontWeight: 600,
        cursor: 'pointer'
    },
    buttonWarning: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        backgroundColor: '#f59e0b',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontWeight: 600,
        cursor: 'pointer'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '1.25rem'
    },
    statCard: (color) => ({
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1rem',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        borderLeft: `4px solid ${color}`,
        display: 'flex',
        alignItems: 'center'
    }),
    iconBox: (bgColor) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '50%',
        backgroundColor: bgColor,
        marginRight: '0.75rem'
    }),
    statContent: {
        flex: 1
    },
    statTitle: {
        fontSize: '0.8rem',
        fontWeight: 500,
        color: '#64748b',
        marginBottom: '0.25rem'
    },
    statValue: {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: '0.25rem'
    },
    statSubtitle: {
        fontSize: '0.7rem',
        color: '#64748b'
    },
    filtersSection: {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1rem',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        marginBottom: '1.25rem'
    },
    filtersTitle: {
        fontSize: '0.9rem',
        fontWeight: 600,
        marginBottom: '0.75rem'
    },
    filtersGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '0.75rem',
        marginBottom: '0.75rem'
    },
    formGroup: {
        marginBottom: '0.75rem'
    },
    label: {
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: '#64748b',
        marginBottom: '0.3rem'
    },
    select: {
        display: 'block',
        width: '100%',
        padding: '0.4rem',
        borderRadius: '0.375rem',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white',
        fontSize: '0.8rem'
    },
    inputWrapper: {
        position: 'relative'
    },
    inputIcon: {
        position: 'absolute',
        left: '0.75rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#94a3b8',
        pointerEvents: 'none'
    },
    input: {
        display: 'block',
        width: '100%',
        padding: '0.4rem 0.6rem 0.4rem 2rem',
        borderRadius: '0.375rem',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white',
        fontSize: '0.8rem'
    },
    buttonActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        marginTop: '0.75rem'
    },
    buttonSecondary: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        backgroundColor: 'white',
        color: '#64748b',
        border: '1px solid #e2e8f0',
        borderRadius: '0.375rem',
        fontWeight: 500,
        cursor: 'pointer'
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse'
    },
    tableHeader: {
        backgroundColor: '#f8fafc',
        textAlign: 'left',
        padding: '0.6rem 0.75rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid #e2e8f0'
    },
    tableCell: {
        padding: '0.6rem 0.75rem',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.8rem',
        color: '#334155'
    },
    loading: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 0'
    },
    spinner: {
        borderWidth: '3px',
        borderStyle: 'solid',
        borderRadius: '50%',
        borderColor: '#e2e8f0',
        borderTopColor: '#4f46e5',
        width: '2.5rem',
        height: '2.5rem',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem'
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 0'
    },
    emptyIcon: {
        fontSize: '3rem',
        color: '#94a3b8',
        marginBottom: '1rem'
    },
    emptyTitle: {
        fontSize: '1.25rem',
        fontWeight: 600,
        color: '#334155',
        marginBottom: '0.5rem'
    },
    emptyText: {
        color: '#64748b',
        textAlign: 'center',
        maxWidth: '24rem',
        marginBottom: '1.5rem'
    },
    errorMessage: {
        backgroundColor: '#fef2f2',
        borderLeftWidth: '4px',
        borderLeftColor: '#ef4444',
        borderRadius: '0.375rem',
        padding: '1rem',
        marginBottom: '1.5rem'
    },
    statusBadge: (color, bgColor) => ({
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: bgColor,
        color: color,
        borderRadius: '9999px',
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 500
    }),
    actionButton: (color, bgColor) => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bgColor,
        color: color,
        width: '1.75rem',
        height: '1.75rem',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        marginLeft: '0.375rem'
    }),
    helpBox: {
        backgroundColor: '#fff7ed',
        borderRadius: '0.375rem',
        padding: '0.75rem',
        borderLeft: '4px solid #f59e0b',
        maxWidth: '24rem',
        margin: '0 auto'
    }
};

export default function ChequeManagement() {
    // State variables
    const [cheques, setCheques] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [ledgerHeads, setLedgerHeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Statistics & counts
    const [stats, setStats] = useState({
        counts: {
            pending: 0,
            cleared: 0,
            cancelled: 0,
            total: 0
        },
        values: {
            pending: 0,
            cleared: 0,
            cancelled: 0
        }
    });

    // Filters
    const [filters, setFilters] = useState({
        status: 'pending', // Default to showing pending cheques
        account_id: '',
        ledger_head_id: '',
        from_date: '',
        to_date: ''
    });

    // Configure axios
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: 8000, // Increased timeout
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch data on component mount and when filters change
    useEffect(() => {
        fetchInitialData();
    }, []);

    // Fetch all necessary data
    const fetchInitialData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                fetchAccounts(),
                fetchLedgerHeads()
            ]);
            await fetchCheques(); // Fetch cheques after reference data is loaded
        } catch (err) {
            console.error('Error during initial data loading:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch cheques with filters
    const fetchCheques = async () => {
        try {
            setLoading(true);
            setError(null);

            // Construct query params from filters
            const queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    queryParams.append(key, value);
                }
            });

            const response = await api.get(`/api/cheques?${queryParams.toString()}`);

            if (response.data.success) {
                // Handle cheque data
                const chequeData = response.data.data || [];
                setCheques(Array.isArray(chequeData) ? chequeData : []);

                // Update statistics
                setStats({
                    counts: response.data.counts || {
                        pending: 0,
                        cleared: 0,
                        cancelled: 0,
                        total: 0
                    },
                    values: {
                        pending: response.data.totalPendingValue || 0,
                        cleared: response.data.totalClearedValue || 0,
                        cancelled: response.data.totalCancelledValue || 0
                    }
                });
            } else {
                setCheques([]);
                setError(response.data.message || 'Failed to fetch cheques');
            }
        } catch (err) {
            console.error('Error fetching cheques:', err);
            setError(err.response?.data?.message || err.message || 'Error connecting to server');
            setCheques([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch accounts for filter dropdown
    const fetchAccounts = async () => {
        try {
            const response = await api.get('/api/accounts');
            if (response.data.success && response.data.data) {
                setAccounts(Array.isArray(response.data.data) ? response.data.data : []);
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);
            toast.error('Failed to load account data');
        }
    };

    // Fetch ledger heads for filter dropdown
    const fetchLedgerHeads = async () => {
        try {
            const response = await api.get('/api/ledger-heads');
            if (response.data.success && response.data.data) {
                setLedgerHeads(Array.isArray(response.data.data) ? response.data.data : []);
            }
        } catch (err) {
            console.error('Error fetching ledger heads:', err);
            toast.error('Failed to load ledger head data');
        }
    };

    // Handle filter changes
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Apply filters
    const applyFilters = () => {
        fetchCheques();
    };

    // Reset filters
    const resetFilters = () => {
        setFilters({
            status: 'pending',
            account_id: '',
            ledger_head_id: '',
            from_date: '',
            to_date: ''
        });
        setTimeout(() => fetchCheques(), 0);
    };

    // Fix missing cheque records
    const handleFixMissingCheques = async () => {
        if (!window.confirm('This will create missing cheque records for transactions with cash_type="cheque". Continue?')) {
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/api/cheques/fix-missing');

            if (response.data.success) {
                toast.success(response.data.message || 'Missing cheque records fixed successfully');
                fetchCheques();
            } else {
                toast.error(response.data.message || 'Failed to fix missing cheque records');
            }
        } catch (err) {
            console.error('Error fixing missing cheque records:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to fix missing cheque records');
        } finally {
            setLoading(false);
        }
    };

    // Mark a cheque as cleared
    const handleClearCheque = async (chequeId) => {
        if (!window.confirm('Are you sure you want to clear this cheque? This will deduct the amount from balances.')) {
            return;
        }

        try {
            setLoading(true);
            const response = await api.put(`/api/cheques/${chequeId}/clear`, {
                clearing_date: new Date().toISOString().split('T')[0] // Today's date
            });

            if (response.data.success) {
                toast.success('Cheque cleared successfully');
                fetchCheques(); // Refresh the list
            } else {
                toast.error(response.data.message || 'Failed to clear cheque');
            }
        } catch (err) {
            console.error('Error clearing cheque:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to clear cheque');
        } finally {
            setLoading(false);
        }
    };

    // Cancel a cheque
    const handleCancelCheque = async (chequeId) => {
        const reason = window.prompt('Please enter a reason for cancellation (optional):');
        if (reason === null) return; // User clicked Cancel on the prompt

        try {
            setLoading(true);
            const response = await api.put(`/api/cheques/${chequeId}/cancel`, { reason });

            if (response.data.success) {
                toast.success('Cheque cancelled successfully');
                fetchCheques(); // Refresh the list
            } else {
                toast.error(response.data.message || 'Failed to cancel cheque');
            }
        } catch (err) {
            console.error('Error cancelling cheque:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to cancel cheque');
        } finally {
            setLoading(false);
        }
    };

    // Format currency
    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            style: 'currency',
            currency: 'INR'
        });
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (err) {
            return 'Invalid Date';
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.titleWrapper}>
                    <FaFileInvoiceDollar style={styles.icon} />
                    <h2 style={styles.title}>Cheque Management</h2>
                </div>

                <div style={styles.actions}>
                    <button
                        style={styles.buttonPrimary}
                        onClick={fetchCheques}
                        disabled={loading}
                    >
                        <FaSyncAlt className={loading ? "spinning" : ""} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div style={styles.statsGrid}>
                <div style={styles.statCard('#facc15')}>
                    <div style={styles.iconBox('#fef9c3')}>
                        <FaMoneyBillWave style={{ color: '#ca8a04', fontSize: '1.25rem' }} />
                    </div>
                    <div style={styles.statContent}>
                        <p style={styles.statTitle}>Pending Cheques</p>
                        <p style={styles.statValue}>{stats.counts.pending || 0}</p>
                        <p style={styles.statSubtitle}>Total: {formatCurrency(stats.values.pending)}</p>
                    </div>
                </div>

                <div style={styles.statCard('#10b981')}>
                    <div style={styles.iconBox('#d1fae5')}>
                        <FaCheck style={{ color: '#059669', fontSize: '1.25rem' }} />
                    </div>
                    <div style={styles.statContent}>
                        <p style={styles.statTitle}>Cleared Cheques</p>
                        <p style={styles.statValue}>{stats.counts.cleared || 0}</p>
                        <p style={styles.statSubtitle}>Total: {formatCurrency(stats.values.cleared)}</p>
                    </div>
                </div>

                <div style={styles.statCard('#ef4444')}>
                    <div style={styles.iconBox('#fee2e2')}>
                        <FaTimes style={{ color: '#dc2626', fontSize: '1.25rem' }} />
                    </div>
                    <div style={styles.statContent}>
                        <p style={styles.statTitle}>Cancelled Cheques</p>
                        <p style={styles.statValue}>{stats.counts.cancelled || 0}</p>
                        <p style={styles.statSubtitle}>Total: {formatCurrency(stats.values.cancelled)}</p>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div style={styles.errorMessage}>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <FaTimes style={{ color: '#ef4444', marginRight: '0.75rem', marginTop: '0.25rem' }} />
                        <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p>
                    </div>
                </div>
            )}

            {/* Filters Section */}
            <div style={styles.filtersSection}>
                <h3 style={styles.filtersTitle}>Filter Cheques</h3>
                <div style={styles.filtersGrid}>
                    <div style={styles.formGroup}>
                        <label htmlFor="status" style={styles.label}>Status</label>
                        <select
                            id="status"
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            style={styles.select}
                            disabled={loading}
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="cleared">Cleared</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label htmlFor="account_id" style={styles.label}>Account</label>
                        <select
                            id="account_id"
                            name="account_id"
                            value={filters.account_id}
                            onChange={handleFilterChange}
                            style={styles.select}
                            disabled={loading}
                        >
                            <option value="">All Accounts</option>
                            {accounts.map(account => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label htmlFor="from_date" style={styles.label}>From Date</label>
                        <div style={styles.inputWrapper}>
                            <FaCalendarAlt style={styles.inputIcon} />
                            <input
                                type="date"
                                id="from_date"
                                name="from_date"
                                value={filters.from_date}
                                onChange={handleFilterChange}
                                style={styles.input}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label htmlFor="to_date" style={styles.label}>To Date</label>
                        <div style={styles.inputWrapper}>
                            <FaCalendarAlt style={styles.inputIcon} />
                            <input
                                type="date"
                                id="to_date"
                                name="to_date"
                                value={filters.to_date}
                                onChange={handleFilterChange}
                                style={styles.input}
                                disabled={loading}
                            />
                        </div>
                    </div>
                </div>

                <div style={styles.buttonActions}>
                    <button
                        onClick={resetFilters}
                        style={styles.buttonSecondary}
                        disabled={loading}
                    >
                        <FaTimes />
                        <span>Reset</span>
                    </button>
                    <button
                        onClick={applyFilters}
                        style={styles.buttonPrimary}
                        disabled={loading}
                    >
                        <FaFilter />
                        <span>Apply Filters</span>
                    </button>
                </div>
            </div>

            {/* Cheques List */}
            <div style={styles.tableContainer}>
                {loading ? (
                    <div style={styles.loading}>
                        <div style={styles.spinner}></div>
                        <p style={{ color: '#64748b', margin: 0 }}>Loading cheques...</p>
                    </div>
                ) : cheques.length === 0 ? (
                    <div style={styles.emptyState}>
                        <FaFileInvoiceDollar style={styles.emptyIcon} />
                        <h3 style={styles.emptyTitle}>No cheques found</h3>
                        <p style={styles.emptyText}>No cheques match your current filter criteria.</p>

                        {filters.status === 'pending' && (
                            <div style={styles.helpBox}>
                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                    <FaInfoCircle style={{ color: '#f59e0b', marginRight: '0.75rem', marginTop: '0.25rem' }} />
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#92400e' }}>If you expected to see pending cheques, please check:</p>
                                        <ul style={{ margin: '0', paddingLeft: '1.25rem', color: '#92400e' }}>
                                            <li>You have created transactions with payment method "Cheque"</li>
                                            <li>The transactions have status "pending"</li>
                                            <li>Try clicking the <strong>"Fix Missing Cheques"</strong> button</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.tableHeader}>Cheque #</th>
                                    <th style={styles.tableHeader}>Bank</th>
                                    <th style={styles.tableHeader}>Account / Ledger Head</th>
                                    <th style={styles.tableHeader}>Amount</th>
                                    <th style={styles.tableHeader}>Issue Date</th>
                                    <th style={styles.tableHeader}>Due Date</th>
                                    <th style={styles.tableHeader}>Status</th>
                                    <th style={{ ...styles.tableHeader, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cheques.map((cheque) => {
                                    // Safely extract transaction data
                                    const amount = cheque.transaction?.amount || 0;
                                    const accountName = cheque.account?.name || 'Unknown Account';
                                    const ledgerHeadName = cheque.ledgerHead?.name || cheque.transaction?.ledgerHead?.name || 'Unknown Ledger';
                                    const chequeNumber = cheque.cheque_number || cheque.transaction?.cheque_number || 'No Number';
                                    const bankName = cheque.bank_name || cheque.transaction?.bank_name || 'Not Specified';

                                    // Status badge configuration
                                    let statusBadge;
                                    switch (cheque.status) {
                                        case 'pending':
                                            statusBadge = styles.statusBadge('#ca8a04', '#fef9c3');
                                            break;
                                        case 'cleared':
                                            statusBadge = styles.statusBadge('#059669', '#d1fae5');
                                            break;
                                        case 'cancelled':
                                            statusBadge = styles.statusBadge('#dc2626', '#fee2e2');
                                            break;
                                        default:
                                            statusBadge = styles.statusBadge('#64748b', '#f1f5f9');
                                    }

                                    return (
                                        <tr key={cheque.id}>
                                            <td style={{ ...styles.tableCell, fontWeight: 500 }}>{chequeNumber}</td>
                                            <td style={styles.tableCell}>{bankName}</td>
                                            <td style={styles.tableCell}>
                                                <div style={{ fontWeight: 500 }}>{accountName}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ledgerHeadName}</div>
                                            </td>
                                            <td style={{ ...styles.tableCell, fontWeight: 500 }}>{formatCurrency(amount)}</td>
                                            <td style={styles.tableCell}>{formatDate(cheque.issue_date || cheque.transaction?.issue_date)}</td>
                                            <td style={styles.tableCell}>{formatDate(cheque.due_date || cheque.transaction?.due_date)}</td>
                                            <td style={styles.tableCell}>
                                                <span style={statusBadge}>
                                                    {cheque.status === 'pending' && <FaMoneyBillWave style={{ marginRight: '0.25rem' }} />}
                                                    {cheque.status === 'cleared' && <FaCheck style={{ marginRight: '0.25rem' }} />}
                                                    {cheque.status === 'cancelled' && <FaTimes style={{ marginRight: '0.25rem' }} />}
                                                    {cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1)}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                                                {cheque.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleClearCheque(cheque.id)}
                                                            style={styles.actionButton('#059669', '#d1fae5')}
                                                            title="Mark as Cleared"
                                                            disabled={loading}
                                                        >
                                                            <FaCheck />
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancelCheque(cheque.id)}
                                                            style={styles.actionButton('#dc2626', '#fee2e2')}
                                                            title="Cancel Cheque"
                                                            disabled={loading}
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    </>
                                                )}
                                                {cheque.status === 'cleared' && (
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        {cheque.clearing_date ? `Cleared on ${formatDate(cheque.clearing_date)}` : 'Cleared'}
                                                    </span>
                                                )}
                                                {cheque.status === 'cancelled' && (
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        Cancelled
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CSS for animations */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .spinning {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
}

