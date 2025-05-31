// Update the projected balance calculation to exclude pending cheques
const calculateProjectedBalance = (currentBalance, pendingTransactions) => {
    // Skip pending cheque transactions
    const relevantTransactions = pendingTransactions.filter(tx => !(tx.cash_type === 'cheque' && tx.status === 'pending'));

    let projected = parseFloat(currentBalance);
    for (const tx of relevantTransactions) {
        if (tx.tx_type === 'credit') {
            projected += parseFloat(tx.amount);
        } else {
            projected -= parseFloat(tx.amount);
        }
    }
    return projected;
};

return (
    <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Current Balance</h3>

        {/* Current Balance */}
        <div className="flex justify-between mb-2">
            <span className="text-gray-600">Cash in Hand:</span>
            <span className="font-semibold text-gray-800">{formatCurrency(cashBalance)}</span>
        </div>
        <div className="flex justify-between mb-4">
            <span className="text-gray-600">Cash in Bank:</span>
            <span className="font-semibold text-gray-800">{formatCurrency(bankBalance)}</span>
        </div>
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
            <span className="text-gray-600">Total Balance:</span>
            <span className="text-xl font-bold text-gray-800">{formatCurrency(currentBalance)}</span>
        </div>

        {/* Projected Balance */}
        {pendingTransactions.length > 0 && (
            <div>
                <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                    Projected Balance After Pending Transactions
                    <div className="relative ml-2 group">
                        <span className="cursor-help">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 w-64 bg-gray-800 text-white text-xs rounded py-2 px-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                            Pending cheques do not affect balances until cleared. Only completed transactions are included in this projection.
                        </div>
                    </div>
                </h4>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Projected Total:</span>
                    <span className={`text-lg font-bold ${projectedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(projectedBalance)}
                    </span>
                </div>
                <div className="mt-2 text-xs text-gray-500 italic">
                    * Based on {pendingTransactions.length} pending transaction(s)
                </div>
            </div>
        )}
    </div>
); 