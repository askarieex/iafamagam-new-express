import React from 'react';
import { FaMoneyBillWave, FaHandHolding, FaUniversity, FaArrowRight } from 'react-icons/fa';

const AccountCard = ({ account }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Calculate percentage of total balance
    const handPercentage = (account.hand_balance / account.total_balance) * 100;
    const bankPercentage = (account.bank_balance / account.total_balance) * 100;

    return (
        <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-md hover:shadow-lg dark:shadow-none p-5 
                       border border-secondary-200 dark:border-secondary-700 transition-all duration-300 
                       hover:scale-[1.02] hover:-translate-y-1">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-secondary-200 dark:border-secondary-700">
                <h2 className="text-base font-semibold text-secondary-900 dark:text-white truncate">{account.name}</h2>
                <button className="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 p-1 rounded-full
                                 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
                    <FaArrowRight className="text-sm" />
                </button>
            </div>
            
            <div className="space-y-4">
                <div className="bg-secondary-50 dark:bg-secondary-700/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-secondary-500 dark:text-secondary-400 mb-1">Total Balance</div>
                    <div className="text-xl font-bold text-primary-600 dark:text-primary-400">{formatCurrency(account.total_balance)}</div>
                </div>

                <div className="space-y-2">
                    <div className="h-2 bg-secondary-200 dark:bg-secondary-700 rounded-full flex overflow-hidden">
                        <div
                            className="h-full bg-hand transition-all duration-500 ease-out rounded-l-full"
                            style={{ width: `${handPercentage}%` }}
                        ></div>
                        <div
                            className="h-full bg-bank transition-all duration-500 ease-out rounded-r-full"
                            style={{ width: `${bankPercentage}%` }}
                        ></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary-50 dark:bg-secondary-700/30 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center text-xs font-medium text-secondary-600 dark:text-secondary-400">
                                <FaHandHolding className="text-hand mr-1" size={12} />
                                <span>Hand</span>
                            </div>
                            <div className="text-xs font-medium text-secondary-500 dark:text-secondary-400">
                                {handPercentage.toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-sm font-semibold text-secondary-900 dark:text-white">
                            {formatCurrency(account.hand_balance)}
                        </div>
                    </div>

                    <div className="bg-secondary-50 dark:bg-secondary-700/30 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center text-xs font-medium text-secondary-600 dark:text-secondary-400">
                                <FaUniversity className="text-bank mr-1" size={12} />
                                <span>Bank</span>
                            </div>
                            <div className="text-xs font-medium text-secondary-500 dark:text-secondary-400">
                                {bankPercentage.toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-sm font-semibold text-secondary-900 dark:text-white">
                            {formatCurrency(account.bank_balance)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountCard; 