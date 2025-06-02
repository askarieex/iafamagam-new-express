import { useState } from 'react';
import { FaLock, FaCalendar, FaFile } from 'react-icons/fa';
import AccountClosureStatus from '../components/accounts/AccountClosureStatus';

export default function PeriodClosure() {
    const [activeTab, setActiveTab] = useState('status');

    return (
        <div className="page-content-wrapper">
            <div className="w-full animate-fadeIn">
                <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-secondary-700">
                        <div className="flex items-center gap-2 mb-3 sm:mb-0">
                            <FaLock className="text-indigo-600 text-xl" />
                            <h2 className="text-lg sm:text-xl font-semibold text-secondary-900 dark:text-white">
                                Accounting Period Management
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6 px-1">
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
                    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 p-6">
                        <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-4">Period Closure Documentation</h2>

                        <div className="prose max-w-none dark:prose-invert">
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
        </div>
    );
}

// Set page title
PeriodClosure.pageTitle = "Period Closure"; 