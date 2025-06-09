import { useState, useEffect } from 'react';
import { FaLock, FaUnlock, FaCalendarAlt, FaChevronDown, FaChevronUp, FaHistory, FaChartLine, FaFileAlt, FaSyncAlt, FaLockOpen } from 'react-icons/fa';
import Layout from '../components/Layout';
import AccountClosureStatus from '../components/accounts/AccountClosureStatus';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import API_CONFIG from '../config';
import Link from 'next/link';
import { useRouter } from 'next/router';
import PeriodStatusBadge from '../components/reports/PeriodStatusBadge';

export default function PeriodManagement() {
    const [activeTab, setActiveTab] = useState('status');
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [ledgerSnapshots, setLedgerSnapshots] = useState([]);
    const [periodHistory, setPeriodHistory] = useState([]);
    const [openPeriod, setOpenPeriod] = useState(null);
    const { user } = useAuth();
    const router = useRouter();

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const years = Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i);

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch current open period when account changes
    useEffect(() => {
        if (selectedAccount) {
            fetchOpenPeriod();
        }
    }, [selectedAccount]);

    // Fetch ledger snapshots when account, year or month changes
    useEffect(() => {
        if (selectedAccount && activeTab === 'snapshots') {
            fetchLedgerSnapshots();
        }
    }, [selectedAccount, selectedYear, selectedMonth, activeTab]);

    // Fetch period history when account changes
    useEffect(() => {
        if (selectedAccount && activeTab === 'history') {
            fetchPeriodHistory();
        }
    }, [selectedAccount, activeTab]);

    // Fetch open period for the selected account
    const fetchOpenPeriod = async () => {
        if (!selectedAccount) return;

        try {
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/open-period`,
                { params: { account_id: selectedAccount.id } }
            );

            if (response.data.success && response.data.data) {
                setOpenPeriod(response.data.data);
                // Auto-select the open period month and year
                setSelectedMonth(response.data.data.month);
                setSelectedYear(response.data.data.year);
            } else {
                setOpenPeriod(null);
                // If no open period, default to current month/year
                setSelectedMonth(new Date().getMonth() + 1);
                setSelectedYear(new Date().getFullYear());
            }
        } catch (error) {
            console.error('Error fetching open period:', error);
            setOpenPeriod(null);
        }
    };

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/status`);
            if (response.data.success) {
                setAccounts(response.data.data || []);

                // If account ID is in URL params, pre-select it
                if (router.query.accountId) {
                    const accountId = parseInt(router.query.accountId);
                    const account = response.data.data.find(a => a.id === accountId);
                    if (account) {
                        setSelectedAccount(account);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            toast.error('Failed to load accounts');
        } finally {
            setLoading(false);
        }
    };

    const fetchLedgerSnapshots = async () => {
        if (!selectedAccount) return;

        try {
            setLoading(true);
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-ledger-balances`, {
                params: {
                    account_id: selectedAccount.id,
                    month: selectedMonth,
                    year: selectedYear
                }
            });

            if (response.data.success) {
                setLedgerSnapshots(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching ledger snapshots:', error);
            toast.error('Failed to load ledger snapshots');
        } finally {
            setLoading(false);
        }
    };

    const fetchPeriodHistory = async () => {
        if (!selectedAccount) return;

        try {
            setLoading(true);
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/history`, {
                params: {
                    account_id: selectedAccount.id
                }
            });

            if (response.data.success) {
                setPeriodHistory(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching period history:', error);
            toast.error('Failed to load period history');
        } finally {
            setLoading(false);
        }
    };

    const handleClosePeriod = async () => {
        if (!selectedAccount) {
            toast.error('Please select an account');
            return;
        }

        if (!window.confirm(`Are you sure you want to close ${months[selectedMonth - 1]} ${selectedYear} for ${selectedAccount.name}?`)) {
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/close`, {
                account_id: selectedAccount.id,
                month: selectedMonth,
                year: selectedYear
            });

            if (response.data.success) {
                toast.success(`Period ${months[selectedMonth - 1]} ${selectedYear} closed successfully`);
                fetchAccounts(); // Refresh account list to show updated last_closed_date
                fetchOpenPeriod(); // Refresh open period status

                if (activeTab === 'history') {
                    fetchPeriodHistory();
                }
            }
        } catch (error) {
            console.error('Error closing period:', error);
            toast.error(error.response?.data?.message || 'Failed to close period');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPeriod = async () => {
        if (!selectedAccount) {
            toast.error('Please select an account');
            return;
        }

        // Check if the selected period is already open
        if (openPeriod &&
            openPeriod.month === selectedMonth &&
            openPeriod.year === selectedYear) {
            toast.info('This period is already open');
            return;
        }

        const message = openPeriod
            ? `This will close the currently open period (${months[openPeriod.month - 1]} ${openPeriod.year}) and open ${months[selectedMonth - 1]} ${selectedYear}. Continue?`
            : `Are you sure you want to open ${months[selectedMonth - 1]} ${selectedYear} for ${selectedAccount.name}?`;

        if (!window.confirm(message)) {
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/monthly-closure/open`, {
                account_id: selectedAccount.id,
                month: selectedMonth,
                year: selectedYear
            });

            if (response.data.success) {
                toast.success(`Period ${months[selectedMonth - 1]} ${selectedYear} opened successfully`);

                if (response.data.warning) {
                    toast.info(response.data.warning);
                }

                fetchOpenPeriod(); // Refresh open period status
                fetchAccounts(); // Refresh account list

                if (activeTab === 'history') {
                    fetchPeriodHistory();
                }
            }
        } catch (error) {
            console.error('Error opening period:', error);
            toast.error(error.response?.data?.message || 'Failed to open period');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never closed';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'current': return 'bg-green-100 text-green-800';
            case 'recent': return 'bg-yellow-100 text-yellow-800';
            case 'outdated': return 'bg-red-100 text-red-800';
            case 'never_closed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const renderAccountSelector = () => (
        <div className="mb-6 border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">Select Account</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {accounts.map(account => (
                    <div
                        key={account.id}
                        onClick={() => setSelectedAccount(account)}
                        className={`p-3 border rounded-md cursor-pointer transition-all ${selectedAccount?.id === account.id
                            ? 'bg-blue-50 border-blue-500'
                            : 'hover:bg-gray-50'
                            }`}
                    >
                        <div className="font-medium">{account.name}</div>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-sm text-gray-500">
                                Last closed: {formatDate(account.last_closed_date)}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(account.status)}`}>
                                {account.status === 'never_closed' ? 'Never Closed' :
                                    account.status === 'current' ? 'Current' :
                                        account.status === 'recent' ? 'Recent' : 'Outdated'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderPeriodClosureControls = () => (
        <div className="mt-3 p-4 bg-white rounded shadow-sm">
            <h5 className="border-bottom pb-2 mb-4">Period Management</h5>
            
            {selectedAccount ? (
                <>
                    <div className="alert alert-info mb-4">
                        <h6 className="mb-2">Current Status:</h6>
                        {openPeriod ? (
                            <div>
                                <span className="badge bg-success me-2">OPEN</span>
                                <strong>{months[openPeriod.month - 1]} {openPeriod.year}</strong> is currently open for {selectedAccount?.name}
                            </div>
                        ) : (
                            <div>
                                <span className="badge bg-danger me-2">CLOSED</span>
                                No period is currently open for {selectedAccount?.name}
                            </div>
                        )}
                    </div>
                    
                    <div className="row">
                        <div className="col-md-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                            <div className="p-2 bg-gray-100 rounded">{selectedAccount.name}</div>
                        </div>

                        <div className="col-md-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                            <select
                                className="border rounded p-2 w-full"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            >
                                {months.map((month, idx) => (
                                    <option key={idx} value={idx + 1}>{month}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                            <select
                                className="border rounded p-2 w-full"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6 self-end flex gap-2">
                            <button
                                onClick={handleOpenPeriod}
                                disabled={loading || (openPeriod?.month === selectedMonth && openPeriod?.year === selectedYear)}
                                className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 flex items-center gap-1 disabled:bg-green-400"
                            >
                                <FaLockOpen className="mr-1" />
                                {loading ? 'Processing...' : 'Open Period'}
                            </button>

                            <button
                                onClick={handleClosePeriod}
                                disabled={loading || !(openPeriod?.month === selectedMonth && openPeriod?.year === selectedYear)}
                                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 flex items-center gap-1 disabled:bg-blue-400"
                            >
                                <FaLock className="mr-1" />
                                {loading ? 'Processing...' : 'Close Period'}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="alert alert-warning">
                    <h6>No Account Selected</h6>
                    <p>Please select an account to manage its periods.</p>
                </div>
            )}
        </div>
    );

    const renderLedgerSnapshots = () => (
        <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Monthly Ledger Snapshots</h2>

            {selectedAccount ? (
                <>
                    <div className="bg-white p-4 rounded-md border mb-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                                <select
                                    className="border rounded p-2 w-full"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                >
                                    {months.map((month, idx) => (
                                        <option key={idx} value={idx + 1}>{month}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                <select
                                    className="border rounded p-2 w-full"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                >
                                    {years.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="self-end">
                                <button
                                    onClick={fetchLedgerSnapshots}
                                    disabled={loading}
                                    className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 flex items-center gap-1 disabled:bg-green-400"
                                >
                                    <FaSyncAlt className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                                    {loading ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center p-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                            <p className="mt-2">Loading snapshots...</p>
                        </div>
                    ) : ledgerSnapshots.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white border">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="py-2 px-4 border text-left">Ledger Head</th>
                                        <th className="py-2 px-4 border text-right">Opening Balance</th>
                                        <th className="py-2 px-4 border text-right">Receipts</th>
                                        <th className="py-2 px-4 border text-right">Payments</th>
                                        <th className="py-2 px-4 border text-right">Closing Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledgerSnapshots.map((snapshot) => (
                                        <tr key={snapshot.id} className="hover:bg-gray-50">
                                            <td className="py-2 px-4 border">{snapshot.ledger_head?.name || 'Unknown'}</td>
                                            <td className="py-2 px-4 border text-right">
                                                {parseFloat(snapshot.opening_balance).toFixed(2)}
                                            </td>
                                            <td className="py-2 px-4 border text-right text-green-600">
                                                {parseFloat(snapshot.receipts).toFixed(2)}
                                            </td>
                                            <td className="py-2 px-4 border text-right text-red-600">
                                                {parseFloat(snapshot.payments).toFixed(2)}
                                            </td>
                                            <td className="py-2 px-4 border text-right font-medium">
                                                {parseFloat(snapshot.closing_balance).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-semibold">
                                        <td className="py-2 px-4 border">Total</td>
                                        <td className="py-2 px-4 border text-right">
                                            {ledgerSnapshots
                                                .reduce((sum, s) => sum + parseFloat(s.opening_balance), 0)
                                                .toFixed(2)}
                                        </td>
                                        <td className="py-2 px-4 border text-right text-green-600">
                                            {ledgerSnapshots
                                                .reduce((sum, s) => sum + parseFloat(s.receipts), 0)
                                                .toFixed(2)}
                                        </td>
                                        <td className="py-2 px-4 border text-right text-red-600">
                                            {ledgerSnapshots
                                                .reduce((sum, s) => sum + parseFloat(s.payments), 0)
                                                .toFixed(2)}
                                        </td>
                                        <td className="py-2 px-4 border text-right">
                                            {ledgerSnapshots
                                                .reduce((sum, s) => sum + parseFloat(s.closing_balance), 0)
                                                .toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-6 text-center border rounded-md">
                            <p className="text-gray-500">No snapshots found for the selected month and year</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 text-yellow-700">
                    Please select an account to view monthly snapshots
                </div>
            )}
        </div>
    );

    const renderPeriodHistory = () => (
        <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Period Closure History</h2>

            {selectedAccount ? (
                loading ? (
                    <div className="text-center p-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        <p className="mt-2">Loading history...</p>
                    </div>
                ) : periodHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="py-2 px-4 border text-left">Action</th>
                                    <th className="py-2 px-4 border text-left">Details</th>
                                    <th className="py-2 px-4 border text-left">User</th>
                                    <th className="py-2 px-4 border text-left">Date & Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {periodHistory.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="py-2 px-4 border">
                                            <span className={
                                                log.action === 'CLOSE_PERIOD' ? 'bg-blue-100 text-blue-800' :
                                                    log.action === 'REOPEN_PERIOD' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                        + ' px-2 py-1 rounded text-sm'}>
                                                {log.action === 'CLOSE_PERIOD' ? 'Close Period' :
                                                    log.action === 'REOPEN_PERIOD' ? 'Reopen Period' :
                                                        log.action === 'FORCE_CLOSE_PERIOD' ? 'Force Close' : log.action}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4 border">{log.details}</td>
                                        <td className="py-2 px-4 border">{log.user?.name || 'System'}</td>
                                        <td className="py-2 px-4 border">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-gray-50 p-6 text-center border rounded-md">
                        <p className="text-gray-500">No period history found for this account</p>
                    </div>
                )
            ) : (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 text-yellow-700">
                    Please select an account to view period history
                </div>
            )}
        </div>
    );

    const renderDocumentation = () => (
        <div className="bg-white p-6 rounded-md border">
            <h2 className="text-lg font-semibold mb-4">Period Management Documentation</h2>

            <div className="space-y-4">
                <div>
                    <h3 className="text-md font-semibold">Single Period Open at a Time</h3>
                    <p className="text-gray-600">
                        Only one period can be open at any given time. When you close a period,
                        all transactions before that date are locked. This ensures data integrity
                        and prevents accidental backdated entries.
                    </p>
                </div>

                <div>
                    <h3 className="text-md font-semibold">Automatic Balance Update</h3>
                    <p className="text-gray-600">
                        When a period is closed, its closing balance automatically becomes the
                        opening balance for the next period. This ensures continuity in your financial records.
                    </p>
                </div>

                <div>
                    <h3 className="text-md font-semibold">Backdated Transactions</h3>
                    <p className="text-gray-600">
                        Administrators can make backdated transactions with the admin override feature.
                        When a backdated transaction is made, the system automatically recalculates all
                        subsequent period balances to maintain accuracy.
                    </p>
                </div>

                <div>
                    <h3 className="text-md font-semibold">Period Reopening</h3>
                    <p className="text-gray-600">
                        In special cases, administrators can reopen a previously closed period by
                        adjusting the last_closed_date. This should be done only when necessary
                        as it allows backdated transactions to be entered again.
                    </p>
                </div>

                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <h3 className="text-md font-semibold text-blue-800">Best Practices</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                        <li>Close periods sequentially without skipping months</li>
                        <li>Verify all transactions are entered before closing a period</li>
                        <li>Review ledger snapshots after closing to confirm accuracy</li>
                        <li>Avoid reopening periods unless absolutely necessary</li>
                        <li>Monitor the period closure history for audit purposes</li>
                    </ul>
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="container mx-auto px-4 py-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Period Management</h1>
                </div>

                {/* Tab Navigation */}
                <div className="mb-6">
                    <div className="border-b">
                        <div className="flex flex-wrap -mb-px">
                            <button
                                className={`mr-2 py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'status' ? 'border-blue-500 text-blue-600' : 'border-transparent hover:border-gray-300'}`}
                                onClick={() => setActiveTab('status')}
                            >
                                <FaLock className="inline mr-2" />
                                Period Status
                            </button>
                            <button
                                className={`mr-2 py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'snapshots' ? 'border-blue-500 text-blue-600' : 'border-transparent hover:border-gray-300'}`}
                                onClick={() => setActiveTab('snapshots')}
                            >
                                <FaChartLine className="inline mr-2" />
                                Ledger Snapshots
                            </button>
                            <button
                                className={`mr-2 py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent hover:border-gray-300'}`}
                                onClick={() => setActiveTab('history')}
                            >
                                <FaHistory className="inline mr-2" />
                                Period History
                            </button>
                            <button
                                className={`mr-2 py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'docs' ? 'border-blue-500 text-blue-600' : 'border-transparent hover:border-gray-300'}`}
                                onClick={() => setActiveTab('docs')}
                            >
                                <FaFileAlt className="inline mr-2" />
                                Documentation
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tab Content */}
                <div>
                    {loading && !accounts.length ? (
                        <div className="text-center p-10">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                            <p className="mt-2">Loading period information...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab !== 'docs' && renderAccountSelector()}

                            {activeTab === 'status' && renderPeriodClosureControls()}
                            {activeTab === 'snapshots' && renderLedgerSnapshots()}
                            {activeTab === 'history' && renderPeriodHistory()}
                            {activeTab === 'docs' && renderDocumentation()}
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}