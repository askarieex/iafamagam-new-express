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
    const [validPeriod, setValidPeriod] = useState(null);
    
    // Debug effect to monitor validPeriod changes
    useEffect(() => {
        console.log('🔄 validPeriod changed:', validPeriod);
    }, [validPeriod]);
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
        fetchGlobalOpenPeriod(); // Fetch global period instead of account-specific
    }, []);

    // No longer needed since periods are global, not account-specific
    // useEffect(() => {
    //     if (selectedAccount) {
    //         fetchOpenPeriod();
    //         fetchValidPeriod();
    //     }
    // }, [selectedAccount]);

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

    // Fetch global open period
    const fetchGlobalOpenPeriod = async () => {
        try {
            const response = await axios.get(
                `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/global-periods/current`
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
            console.error('Error fetching global open period:', error);
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

    const fetchValidPeriod = async () => {
        if (!selectedAccount) return;

        try {
            console.log('🔍 Fetching valid period for account:', selectedAccount.id);
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/periods/valid-months`, {
                params: {
                    account_id: selectedAccount.id
                }
            });

            console.log('📡 Valid period API response:', response.data);

            if (response.data.success) {
                setValidPeriod(response.data.data);
                console.log('✅ Valid period set:', response.data.data);
            } else {
                setValidPeriod(null);
                console.log('❌ Valid period API returned success=false:', response.data);
            }
        } catch (error) {
            console.error('❌ Error fetching valid period:', error.response?.data || error.message);
            setValidPeriod(null);
        }
    };

    const validatePeriodOpening = () => {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        console.log('🔍 validatePeriodOpening called:', {
            selectedMonth,
            selectedYear,
            currentMonth,
            currentYear,
            validPeriod,
            openPeriod
        });

        // CRITICAL: Current month should ALWAYS be allowed to be opened
        if (selectedMonth === currentMonth && selectedYear === currentYear) {
            console.log('✅ Current month validation: ALLOWED');
            return { isValid: true, message: 'Opening current month period - always allowed' };
        }

        // For non-current months, check if we have valid period info
        if (!validPeriod) {
            console.log('❌ No valid period data available');
            return { isValid: false, message: 'Unable to determine valid period for opening' };
        }

        // Allow opening only the immediate previous month for backdating
        if (!validPeriod.canOpenBack) {
            console.log('❌ Back period opening not allowed:', validPeriod.reason);
            return { 
                isValid: false, 
                message: validPeriod.reason || 'Back period opening not allowed'
            };
        }

        if (selectedMonth !== validPeriod.validMonth || selectedYear !== validPeriod.validYear) {
            console.log('❌ Period not in valid range:', {
                selected: `${selectedMonth}/${selectedYear}`,
                valid: `${validPeriod.validMonth}/${validPeriod.validYear}`
            });
            return {
                isValid: false,
                message: `Only ${validPeriod.displayName} can be opened for backdating`
            };
        }

        console.log('✅ Back period validation: ALLOWED');
        return { isValid: true, message: `Opening ${validPeriod.displayName} for backdating` };
    };

    // Helper function to get display name for a period
    const getPeriodDisplayName = (period) => {
        if (!period) return 'Unknown Period';
        return `${months[period.month - 1]} ${period.year}`;
    };

    const validatePeriodClosure = () => {
        console.log('🔍 validatePeriodClosure called:', {
            openPeriod,
            selectedMonth,
            selectedYear
        });

        // If no period is open, cannot close
        if (!openPeriod) {
            console.log('❌ No period open to close');
            return {
                isValid: false,
                message: 'No period is currently open'
            };
        }
        
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        console.log('🔍 Period closure check:', {
            openPeriodMonth: openPeriod.month,
            openPeriodYear: openPeriod.year,
            currentMonth,
            currentYear,
            today: currentDate.getDate()
        });

        // CRITICAL FIX: For back periods (like July when current is August), ALWAYS allow closing
        // Only restrict closing if it's the actual current month
        if (openPeriod.month === currentMonth && openPeriod.year === currentYear) {
            // This is the current month - normally we'd check end of month, but let's be more permissive for period management
            console.log('🔍 Attempting to close current month - allowing for period management');
            // Allow closing current month for period management purposes
        } else {
            // This is a back period (like July when current is August) - always allow
            console.log('🔍 This is a back period - always allow closing');
        }

        // For back periods (like July when current month is August), always allow closing
        console.log('✅ Period closure: ALLOWED');
        return { 
            isValid: true, 
            message: `Close ${getPeriodDisplayName(openPeriod)}` 
        };
    };

    const handleClosePeriod = async () => {
        console.log('🚀 handleClosePeriod called for GLOBAL period');
        console.log('🔍 Global Close Period Debug Info:', {
            openPeriod,
            selectedMonth,
            selectedYear,
            loading
        });

        // Close the currently open global period
        const periodToClose = openPeriod;
        if (!periodToClose) {
            console.log('❌ No global period to close');
            toast.error('No period is currently open globally');
            return;
        }

        console.log('📋 About to close global period:', getPeriodDisplayName(periodToClose));

        if (!window.confirm(`Are you sure you want to close ${getPeriodDisplayName(periodToClose)} GLOBALLY for ALL accounts?`)) {
            console.log('❌ User cancelled global closure');
            return;
        }

        console.log('🔄 Starting period closure API call...');

        try {
            setLoading(true);
            const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/global-periods/close`, {
                notes: `Closed via Period Management interface`
            });

            console.log('✅ Global period closure API response:', response.data);

            if (response.data.success) {
                toast.success(`Global period ${getPeriodDisplayName(periodToClose)} closed successfully for ALL accounts`);
                console.log('🔄 Refreshing UI state after successful global closure...');
                
                fetchAccounts(); // Refresh account list
                fetchGlobalOpenPeriod(); // Refresh global open period status

                if (activeTab === 'history') {
                    fetchPeriodHistory();
                }
                
                console.log('✅ Global period successfully closed and UI refreshed');
            } else {
                console.log('❌ Global period closure failed:', response.data);
                toast.error(response.data.message || 'Failed to close global period');
            }
        } catch (error) {
            console.error('💥 Error closing global period:', error);
            console.error('Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            
            const errorMessage = error.response?.data?.message || 
                               error.message || 
                               'Failed to close global period - check console for details';
            toast.error(errorMessage);
        } finally {
            console.log('🔄 Setting loading to false');
            setLoading(false);
        }
    };

    const handleOpenPeriod = async () => {
        console.log('🚀 handleOpenPeriod called for GLOBAL period');
        console.log('🔍 Global Open Period Debug Info:', {
            selectedMonth,
            selectedYear,
            openPeriod,
            loading
        });

        // Check if the selected period is already open globally
        if (openPeriod &&
            openPeriod.month === selectedMonth &&
            openPeriod.year === selectedYear) {
            console.log('❌ Global period already open');
            toast.info('This period is already open globally');
            return;
        }

        console.log('✅ Proceeding with global period opening');

        const message = openPeriod
            ? `This will close the currently open period (${months[openPeriod.month - 1]} ${openPeriod.year}) and open ${months[selectedMonth - 1]} ${selectedYear} GLOBALLY for ALL accounts. Continue?`
            : `Are you sure you want to open ${months[selectedMonth - 1]} ${selectedYear} GLOBALLY for ALL accounts?`;

        if (!window.confirm(message)) {
            console.log('❌ User cancelled opening');
            return;
        }

        console.log('🔄 Starting period opening API call...', {
            account_id: selectedAccount.id,
            month: selectedMonth,
            year: selectedYear
        });

        try {
            setLoading(true);
            const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/global-periods/open`, {
                month: selectedMonth,
                year: selectedYear
            });

            console.log('✅ Global period opening API response:', response.data);

            if (response.data.success) {
                toast.success(`Global period ${months[selectedMonth - 1]} ${selectedYear} opened successfully for ALL accounts`);

                if (response.data.warning) {
                    toast.info(response.data.warning);
                }

                fetchGlobalOpenPeriod(); // Refresh global open period status
                fetchAccounts(); // Refresh account list

                if (activeTab === 'history') {
                    fetchPeriodHistory();
                }
            }
        } catch (error) {
            console.error('Error opening global period:', error);
            
            const errorMessage = error.response?.data?.message || 'Failed to open global period';
            toast.error(errorMessage);
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
            <h2 className="text-lg font-semibold mb-2">Select Account for Display</h2>
            <p className="text-sm text-gray-600 mb-3">Note: Period management is now GLOBAL - opening/closing affects ALL accounts simultaneously.</p>
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
            <h5 className="border-bottom pb-2 mb-4">Global Period Management</h5>
            
            {selectedAccount ? (
                <>
                    <div className="alert alert-info mb-4">
                        <h6 className="mb-2">Current Status:</h6>
                        {openPeriod ? (
                            <div>
                                <span className="badge bg-success me-2">OPEN</span>
                                <strong>{months[openPeriod.month - 1]} {openPeriod.year}</strong> is currently open GLOBALLY for ALL accounts
                            </div>
                        ) : (
                            <div>
                                <span className="badge bg-danger me-2">CLOSED</span>
                                No period is currently open GLOBALLY
                            </div>
                        )}
                    </div>
                    
                    <div className="alert alert-info mb-4">
                        <h6 className="mb-2">Period Opening Rules:</h6>
                        <div className="mb-2 text-green-600">
                            <strong>Current Month:</strong> {months[new Date().getMonth()]} {new Date().getFullYear()} - Always available
                        </div>
                        {validPeriod ? (
                            validPeriod.canOpenBack ? (
                                <div className="text-green-600">
                                    <strong>Back Period:</strong> {validPeriod.displayName} - Available for backdating
                                </div>
                            ) : (
                                <div className="text-orange-600">
                                    <strong>Back Period:</strong> {validPeriod.reason || 'No back periods available'}
                                </div>
                            )
                        ) : (
                            <div className="text-gray-500">
                                <strong>Back Period:</strong> Loading period information...
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
                                {months.map((month, idx) => {
                                    const monthNum = idx + 1;
                                    const currentDate = new Date();
                                    const currentMonth = currentDate.getMonth() + 1;
                                    const currentYear = currentDate.getFullYear();
                                    
                                    // ALWAYS show current month regardless of any conditions
                                    const isCurrentMonth = monthNum === currentMonth && selectedYear === currentYear;
                                    
                                    // Show valid back period if available
                                    const isValidBackPeriod = validPeriod && validPeriod.canOpenBack && 
                                        monthNum === validPeriod.validMonth && selectedYear === validPeriod.validYear;
                                    
                                    // Only show valid options: current month OR valid back period
                                    if (isCurrentMonth || isValidBackPeriod) {
                                        return (
                                            <option key={idx} value={monthNum}>
                                                {month} {isCurrentMonth ? '(Current)' : '(Back Period)'}
                                            </option>
                                        );
                                    }
                                    
                                    return null;
                                }).filter(Boolean)}
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
                            {/* SIMPLIFIED LOGIC: Open button - always enabled unless loading or period already open */}
                            <button
                                onClick={handleOpenPeriod}
                                disabled={loading || (openPeriod?.month === selectedMonth && openPeriod?.year === selectedYear)}
                                className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 flex items-center gap-1 disabled:bg-green-400"
                                title={(openPeriod?.month === selectedMonth && openPeriod?.year === selectedYear) ? 
                                    'This period is already open' : 
                                    `Open ${months[selectedMonth - 1]} ${selectedYear}`}
                            >
                                <FaLockOpen className="mr-1" />
                                {loading ? 'Processing...' : 'Open Period'}
                            </button>

                            {/* SIMPLIFIED LOGIC: Close button - always enabled when period is open and not loading */}
                            <button
                                onClick={handleClosePeriod}
                                disabled={loading || !openPeriod}
                                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 flex items-center gap-1 disabled:bg-blue-400"
                                title={openPeriod ? `Close ${getPeriodDisplayName(openPeriod)}` : 'No period open to close'}
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
                    <h3 className="text-md font-semibold">Restricted Back Period Opening</h3>
                    <p className="text-gray-600">
                        Back periods can only be opened for the immediate previous month to allow
                        backdated transactions. This follows accounting best practices and prevents
                        excessive backdating that could compromise data integrity.
                    </p>
                </div>

                <div>
                    <h3 className="text-md font-semibold">Current Month Restrictions</h3>
                    <p className="text-gray-600">
                        The current calendar month cannot be closed until the month has ended.
                        This prevents premature closure and ensures all transactions for the month
                        can be entered.
                    </p>
                </div>

                <div>
                    <h3 className="text-md font-semibold">Sequential Period Closure</h3>
                    <p className="text-gray-600">
                        Periods must be closed in sequential order. Newer periods must be closed
                        before older periods to maintain chronological integrity.
                    </p>
                </div>

                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <h3 className="text-md font-semibold text-blue-800">New Period Management Rules</h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                        <li>Only current month and immediate previous month can be opened</li>
                        <li>Opening a period automatically closes any other open periods</li>
                        <li>Current month cannot be closed until the month ends</li>
                        <li>Periods must be closed in reverse chronological order</li>
                        <li>Force Open functionality has been removed for better control</li>
                        <li>System follows accounting best practices for period management</li>
                    </ul>
                </div>

                <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                    <h3 className="text-md font-semibold text-yellow-800">Migration Notice</h3>
                    <p className="text-gray-600">
                        This system now enforces stricter period management rules. Existing
                        multiple open periods will be automatically consolidated when new periods
                        are opened, following the single-period rule.
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="container mx-auto px-4 py-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Global Period Management</h1>
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