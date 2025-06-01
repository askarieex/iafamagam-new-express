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
        <div className="card p-4">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-secondary-200 dark:border-secondary-700">
                <h2 className="text-sm lg:text-base font-semibold text-secondary-900 dark:text-white truncate pr-2">
                    {account.name}
                </h2>
                <button className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-800/40 transition-colors">
                    <FaArrowRight className="w-3 h-3" />
                </button>
            </div>

            <div className="space-y-3 lg:space-y-4">
                <div className="bg-secondary-50 dark:bg-secondary-700/30 rounded-lg px-3 py-2 text-center">
                    <div className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 uppercase tracking-wider">Total Balance</div>
                    <div className="text-lg lg:text-xl font-bold text-primary-600 dark:text-primary-400">{formatCurrency(account.total_balance)}</div>
                </div>

                <div className="space-y-1">
                    <div className="h-2 bg-secondary-200 dark:bg-secondary-700 rounded-full flex overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-success-500 dark:bg-success-500 transition-all duration-500 ease-out"
                            style={{ width: `${handPercentage}%`, borderRadius: handPercentage === 100 ? '9999px' : '9999px 0 0 9999px' }}
                        ></div>
                        <div
                            className="h-full bg-info-500 dark:bg-info-500 transition-all duration-500 ease-out"
                            style={{ width: `${bankPercentage}%`, borderRadius: bankPercentage === 100 ? '9999px' : '0 9999px 9999px 0' }}
                        ></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    <div className="bg-secondary-50 dark:bg-secondary-700/30 rounded-lg p-2 hover:bg-secondary-100 dark:hover:bg-secondary-700/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center text-xs font-medium text-secondary-600 dark:text-secondary-400">
                                <FaHandHolding className="text-success-500 dark:text-success-400 mr-1" size={12} />
                                <span className="uppercase tracking-wider">Hand</span>
                            </div>
                            <div className="text-xs px-1.5 py-0.5 rounded bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400 font-medium">
                                {handPercentage.toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-xs lg:text-sm font-semibold text-secondary-900 dark:text-white">
                            {formatCurrency(account.hand_balance)}
                        </div>
                    </div>

                    <div className="bg-secondary-50 dark:bg-secondary-700/30 rounded-lg p-2 hover:bg-secondary-100 dark:hover:bg-secondary-700/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center text-xs font-medium text-secondary-600 dark:text-secondary-400">
                                <FaUniversity className="text-info-500 dark:text-info-400 mr-1" size={12} />
                                <span className="uppercase tracking-wider">Bank</span>
                            </div>
                            <div className="text-xs px-1.5 py-0.5 rounded bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400 font-medium">
                                {bankPercentage.toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-xs lg:text-sm font-semibold text-secondary-900 dark:text-white">
                            {formatCurrency(account.bank_balance)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountCard; 