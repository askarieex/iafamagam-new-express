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
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Page Header */}
                <div className="bg-white shadow-sm rounded-xl mb-6 overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                        <h1 className="text-2xl font-bold text-gray-800">
                            {pageTitle}
                        </h1>

                        {activeTab === 'list' && (
                            <div className="flex space-x-3">
                                <button
                                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center shadow-sm transition-all duration-150"
                                    onClick={() => setActiveTab('credit')}
                                >
                                    <FaArrowDown className="mr-2 text-blue-200" />
                                    <span>New Credit</span>
                                </button>
                                <button
                                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-white flex items-center shadow-sm transition-all duration-150"
                                    onClick={() => setActiveTab('debit')}
                                >
                                    <FaArrowUp className="mr-2 text-purple-200" />
                                    <span>New Debit</span>
                                </button>
                            </div>
                        )}

                        {(activeTab === 'credit' || activeTab === 'debit' || activeTab === 'details' || activeTab === 'edit-credit' || activeTab === 'edit-debit') && (
                            <button
                                className="flex items-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-all duration-150"
                                onClick={handleBackToList}
                            >
                                <FaChevronLeft className="mr-2 text-gray-500" />
                                <span>Back to List</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="transition-all duration-300 animate-fadeIn">
                    {activeTab === 'list' && (
                        <TransactionsList
                            onViewTransaction={handleViewTransaction}
                            onEditTransaction={handleEditTransaction}
                        />
                    )}

                    {activeTab === 'credit' && (
                        <CreditTransactionForm
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    )}

                    {activeTab === 'debit' && (
                        <DebitTransactionForm
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    )}

                    {activeTab === 'edit-credit' && selectedTransaction && (
                        <CreditTransactionForm
                            transaction={selectedTransaction}
                            isEditing={true}
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    )}

                    {activeTab === 'edit-debit' && selectedTransaction && (
                        <DebitTransactionForm
                            transaction={selectedTransaction}
                            isEditing={true}
                            onSuccess={handleTransactionSuccess}
                            onCancel={handleBackToList}
                        />
                    )}

                    {activeTab === 'details' && selectedTransaction && (
                        <TransactionDetails
                            transactionId={selectedTransaction.id}
                            onBack={handleBackToList}
                            onEditTransaction={handleEditTransaction}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Set custom page title for layout
TransactionsPage.pageTitle = "Transactions"; 