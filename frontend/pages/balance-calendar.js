import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const BalanceCalendar = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [balanceData, setBalanceData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch balance data when date or account changes
    useEffect(() => {
        if (selectedAccount) {
            fetchBalanceData();
        }
    }, [selectedDate, selectedAccount]);

    const fetchAccounts = async () => {
        try {
            const response = await fetch('/api/accounts', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setAccounts(data.data || []);
                if (data.data && data.data.length > 0) {
                    setSelectedAccount(data.data[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchBalanceData = async () => {
        if (!selectedAccount) return;

        setLoading(true);
        setError('');

        try {
            const dateStr = moment(selectedDate).format('YYYY-MM-DD');
            const response = await fetch(
                `/api/reports/balance-by-date/${selectedAccount}?date=${dateStr}`,
                { credentials: 'include' }
            );

            if (response.ok) {
                const data = await response.json();
                setBalanceData(data.data);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to fetch balance data');
            }
        } catch (error) {
            setError('Error fetching balance data');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateSelect = (date) => {
        setSelectedDate(date);
    };

    const handleAccountChange = (e) => {
        setSelectedAccount(e.target.value);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    const getTotalBalance = () => {
        if (!balanceData || !balanceData.credit_heads) return 0;
        return balanceData.credit_heads.reduce((total, head) => total + (head.balance || 0), 0);
    };

    return (
        <Layout>
            <Head>
                <title>Balance Calendar - IAFA Software</title>
            </Head>

            <div className="container-fluid py-4">
                <div className="row">
                    <div className="col-12">
                        <div className="card">
                            <div className="card-header pb-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6>📅 Balance Calendar</h6>
                                        <p className="text-sm mb-0">
                                            View credit head balances by selecting dates on the calendar
                                        </p>
                                    </div>
                                    <div className="d-flex align-items-center gap-3">
                                        <div>
                                            <label className="form-label mb-1">Account</label>
                                            <select
                                                className="form-select form-select-sm"
                                                value={selectedAccount}
                                                onChange={handleAccountChange}
                                            >
                                                <option value="">Select Account</option>
                                                {accounts.map(account => (
                                                    <option key={account.id} value={account.id}>
                                                        {account.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm text-muted">Selected Date</div>
                                            <div className="fw-bold">
                                                {moment(selectedDate).format('MMM DD, YYYY')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="row">
                                    {/* Calendar Section */}
                                    <div className="col-md-8">
                                        <div className="calendar-container" style={{ height: '500px' }}>
                                            <Calendar
                                                localizer={localizer}
                                                events={[]}
                                                startAccessor="start"
                                                endAccessor="end"
                                                views={['month']}
                                                defaultView="month"
                                                onSelectSlot={({ start }) => handleDateSelect(start)}
                                                onSelectEvent={() => {}}
                                                selectable={true}
                                                style={{ height: '100%' }}
                                                dayPropGetter={(date) => {
                                                    const isSelected = moment(date).isSame(selectedDate, 'day');
                                                    if (isSelected) {
                                                        return {
                                                            style: {
                                                                backgroundColor: '#5e72e4',
                                                                color: 'white',
                                                                borderRadius: '4px'
                                                            }
                                                        };
                                                    }
                                                    return {};
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Balance Details Section */}
                                    <div className="col-md-4">
                                        <div className="balance-details">
                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                <h6 className="mb-0">Balance Details</h6>
                                                {loading && <LoadingSpinner size="sm" />}
                                            </div>

                                            {error && (
                                                <div className="alert alert-danger py-2">
                                                    {error}
                                                </div>
                                            )}

                                            {!selectedAccount && (
                                                <div className="alert alert-info py-2">
                                                    Please select an account to view balances
                                                </div>
                                            )}

                                            {selectedAccount && !loading && !error && (
                                                <>
                                                    {/* Total Balance Card */}
                                                    <div className="card bg-primary text-white mb-3">
                                                        <div className="card-body p-3">
                                                            <div className="text-center">
                                                                <div className="text-sm opacity-8">Total Credit Balance</div>
                                                                <div className="h4 mb-0">
                                                                    {formatCurrency(getTotalBalance())}
                                                                </div>
                                                                <div className="text-xs opacity-8">
                                                                    as of {moment(selectedDate).format('MMM DD, YYYY')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Credit Heads List */}
                                                    <div className="credit-heads-list">
                                                        <h6 className="text-sm mb-2">Credit Heads (Income)</h6>

                                                        {balanceData && balanceData.credit_heads && balanceData.credit_heads.length > 0 ? (
                                                            <div className="list-group list-group-flush">
                                                                {balanceData.credit_heads.map((head, index) => (
                                                                    <div key={index} className="list-group-item px-0 py-2 border-0">
                                                                        <div className="d-flex justify-content-between align-items-center">
                                                                            <div>
                                                                                <div className="fw-bold text-sm">
                                                                                    {head.name}
                                                                                </div>
                                                                                <div className="text-xs text-muted">
                                                                                    Cash: {formatCurrency(head.cash_balance)}
                                                                                    {' • '}
                                                                                    Bank: {formatCurrency(head.bank_balance)}
                                                                                </div>
                                                                            </div>
                                                                            <div className="fw-bold text-success">
                                                                                {formatCurrency(head.balance)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-4 text-muted">
                                                                <div className="text-sm">No credit heads found</div>
                                                                <div className="text-xs">
                                                                    or no transactions on this date
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .calendar-container {
                    border: 1px solid #dee2e6;
                    border-radius: 0.375rem;
                    padding: 1rem;
                }

                .balance-details {
                    background: #f8f9fa;
                    border-radius: 0.375rem;
                    padding: 1rem;
                    height: 500px;
                    overflow-y: auto;
                }

                .list-group-item:last-child {
                    border-bottom: 1px solid #dee2e6 !important;
                }

                .rbc-month-view {
                    border: none;
                }

                .rbc-header {
                    background: #f8f9fa;
                    font-weight: 600;
                    padding: 0.5rem;
                    border-bottom: 1px solid #dee2e6;
                }

                .rbc-date-cell {
                    padding: 0.5rem;
                    cursor: pointer;
                }

                .rbc-date-cell:hover {
                    background: #e9ecef;
                }

                .rbc-off-range-bg {
                    background: #f8f9fa;
                    color: #6c757d;
                }

                .rbc-today {
                    background: #fff3cd;
                }
            `}</style>
        </Layout>
    );
};

export default BalanceCalendar;