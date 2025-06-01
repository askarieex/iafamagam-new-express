import { useState } from 'react';
import Layout from '../components/Layout';
import AccountClosureStatus from '../components/accounts/AccountClosureStatus';
import { FaLock, FaCalendar, FaFile } from 'react-icons/fa';

export default function PeriodClosure() {
    const [activeTab, setActiveTab] = useState('status');

    return (
        <Layout>
            <div className="container mx-auto px-4 py-6">
                <h1 className="text-2xl font-semibold mb-6 flex items-center">
                    <FaLock className="mr-2" /> Accounting Period Management
                </h1>

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="flex space-x-8">
                        <button
                            className={`pb-4 px-1 font-medium text-sm flex items-center ${activeTab === 'status'
                                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                                    : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                                }`}
                            onClick={() => setActiveTab('status')}
                        >
                            <FaCalendar className="mr-2" />
                            Period Status
                        </button>
                        <button
                            className={`pb-4 px-1 font-medium text-sm flex items-center ${activeTab === 'documentation'
                                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                                    : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                                }`}
                            onClick={() => setActiveTab('documentation')}
                        >
                            <FaFile className="mr-2" />
                            Documentation
                        </button>
                    </nav>
                </div>

                {/* Tab content */}
                {activeTab === 'status' && (
                    <AccountClosureStatus />
                )}

                {activeTab === 'documentation' && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-medium text-gray-900 mb-4">Period Closure Documentation</h2>

                        <div className="prose max-w-none">
                            <h3>Understanding Period Closure</h3>
                            <p>
                                Period closure is an important accounting practice that locks a specific time period in your financial records,
                                preventing further changes to transactions within that period.
                            </p>

                            <h3>Monthly Snapshots</h3>
                            <p>
                                The system maintains monthly snapshots of each ledger head's financial activity:
                            </p>
                            <ul>
                                <li><strong>Opening Balance</strong>: The beginning balance for the month.</li>
                                <li><strong>Receipts</strong>: All credit transactions (incoming funds) for the month.</li>
                                <li><strong>Payments</strong>: All debit transactions (outgoing funds) for the month.</li>
                                <li><strong>Closing Balance</strong>: The ending balance (Opening + Receipts - Payments).</li>
                                <li><strong>Cash/Bank Breakdown</strong>: Separate tracking of cash and bank movements.</li>
                            </ul>

                            <h3>Why Close Periods?</h3>
                            <ul>
                                <li>Ensures financial data integrity</li>
                                <li>Prevents accidental changes to past records</li>
                                <li>Provides finalized figures for reporting</li>
                                <li>Helps maintain continuity between accounting periods</li>
                                <li>Supports audit requirements</li>
                            </ul>

                            <h3>Best Practices</h3>
                            <p>
                                Typically, you should close a period once all transactions for that month are reconciled and verified.
                                For most organizations, this is done within 15 days after the month ends.
                            </p>

                            <h3>Administrator Overrides</h3>
                            <p>
                                Admins can still make backdated entries in closed periods when necessary. When this happens:
                            </p>
                            <ol>
                                <li>The transaction is marked as an admin override</li>
                                <li>All affected monthly snapshots are automatically recalculated</li>
                                <li>The change is logged for audit purposes</li>
                            </ol>

                            <h3>Reopening Periods</h3>
                            <p>
                                In some scenarios, you might need to reopen a previously closed period. This should be done with caution
                                and proper authorization, as it allows changes to historical data.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
} 