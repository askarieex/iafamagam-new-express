import { useState } from 'react';
import {
    FaExchangeAlt,
    FaArrowUp,
    FaArrowDown,
    FaList,
    FaChevronLeft,
    FaPlus,
    FaEdit
} from 'react-icons/fa';
import TransactionsList from '../components/transactions/TransactionsList';
import CreditTransactionForm from '../components/transactions/CreditTransactionForm';
import DebitTransactionForm from '../components/transactions/DebitTransactionForm';
import TransactionDetails from '../components/transactions/TransactionDetails';

export default function TransactionsPage() {
    const [activeTab, setActiveTab] = useState('list'); // 'list', 'credit', 'debit', 'details', 'edit'
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Open transaction details
    const handleViewTransaction = (transaction) => {
        console.log('Viewing transaction:', transaction);
        setSelectedTransaction(transaction);
        setActiveTab('details');
    };

    // Go back to transactions list
    const handleBackToList = () => {
        setActiveTab('list');
        setSelectedTransaction(null);
    };

    // Handle editing a transaction
    const handleEditTransaction = (transaction) => {
        console.log('Editing transaction:', transaction);
        setSelectedTransaction(transaction);
        // Set the active tab based on transaction type
        setActiveTab(transaction.tx_type === 'credit' ? 'edit-credit' : 'edit-debit');
    };

    // Handle transaction creation success
    const handleTransactionSuccess = (transaction) => {
        // If transaction details are provided, view them
        if (transaction) {
            console.log('Transaction created successfully:', transaction);
            setSelectedTransaction(transaction);
            setActiveTab('details');
        } else {
            // Otherwise go back to list
            handleBackToList();
        }
    };

    // Update page title dynamically based on active tab
    let pageTitle = 'Transactions';
    if (activeTab === 'credit') pageTitle = 'New Credit Transaction';
    if (activeTab === 'debit') pageTitle = 'New Debit Transaction';
    if (activeTab === 'edit-credit') pageTitle = 'Edit Credit Transaction';
    if (activeTab === 'edit-debit') pageTitle = 'Edit Debit Transaction';
    if (activeTab === 'details') pageTitle = `Transaction Details ${selectedTransaction ? `#${selectedTransaction.id.substring(0, 8)}` : ''}`;

    return (
        <div className="w-full space-y-5 animate-fadeIn">
            {/* Page Header */}
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-secondary-700">
                    <h1 className="text-lg sm:text-xl font-semibold text-secondary-900 dark:text-white mb-2 sm:mb-0">
                        {pageTitle}
                    </h1>

                    {activeTab === 'list' && (
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <button
                                className="flex-1 sm:flex-none px-3 py-2 text-xs bg-primary-600 hover:bg-primary-700 rounded-lg text-white font-medium flex items-center justify-center shadow-sm transition-all duration-150"
                                onClick={() => setActiveTab('credit')}
                            >
                                <FaArrowDown className="mr-1.5 text-primary-200" />
                                <span>New Credit</span>
                            </button>
                            <button
                                className="flex-1 sm:flex-none px-3 py-2 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium flex items-center justify-center shadow-sm transition-all duration-150"
                                onClick={() => setActiveTab('debit')}
                            >
                                <FaArrowUp className="mr-1.5 text-purple-200" />
                                <span>New Debit</span>
                            </button>
                        </div>
                    )}

                    {(activeTab === 'credit' || activeTab === 'debit' || activeTab === 'details' || activeTab === 'edit-credit' || activeTab === 'edit-debit') && (
                        <button
                            className="flex items-center px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-secondary-700 dark:hover:bg-secondary-600 rounded-lg text-secondary-700 dark:text-secondary-200 font-medium transition-all duration-150"
                            onClick={handleBackToList}
                        >
                            <FaChevronLeft className="mr-1.5 text-secondary-500 dark:text-secondary-400" />
                            <span>Back</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Content */}
            <div className="transition-all duration-300">
                {activeTab === 'list' && (
                    <TransactionsList
                        onViewTransaction={handleViewTransaction}
                        onEditTransaction={handleEditTransaction}
                    />
                )}

                {activeTab === 'credit' && (
                    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 p-4 sm:p-6">
                        <CreditTransactionForm
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    </div>
                )}

                {activeTab === 'debit' && (
                    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 p-4 sm:p-6">
                        <DebitTransactionForm
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    </div>
                )}

                {activeTab === 'edit-credit' && selectedTransaction && (
                    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 p-4 sm:p-6">
                        <CreditTransactionForm
                            transaction={selectedTransaction}
                            isEditing={true}
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    </div>
                )}

                {activeTab === 'edit-debit' && selectedTransaction && (
                    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 p-4 sm:p-6">
                        <DebitTransactionForm
                            transaction={selectedTransaction}
                            isEditing={true}
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    </div>
                )}

                {activeTab === 'details' && selectedTransaction && (
                    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-sm border border-gray-100 dark:border-secondary-700 overflow-hidden">
                        <TransactionDetails
                            transactionId={selectedTransaction.id}
                            onBack={handleBackToList}
                            onEditTransaction={handleEditTransaction}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// Set custom page title for layout
TransactionsPage.pageTitle = "Transactions"; 