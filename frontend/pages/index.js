import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
    FaMoneyBillWave,
    FaChartLine,
    FaUniversity,
    FaExchangeAlt,
    FaArrowUp,
    FaArrowDown,
    FaHandHolding,
    FaUsers,
    FaCalendarAlt,
    FaFilter,
    FaArrowRight
} from 'react-icons/fa';
import AccountCard from '../components/AccountCard';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Set the page title
const Home = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalBalance, setTotalBalance] = useState(0);
    const [monthlyData, setMonthlyData] = useState({});
    const [categoryData, setCategoryData] = useState({});
    const [selectedPeriod, setSelectedPeriod] = useState('month');
    const [selectedChart, setSelectedChart] = useState('revenue');

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await axios.get('/api/accounts');
                setAccounts(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching accounts:', error);
                setLoading(false);
            }
        };

        // For now, use sample data since we don't have a real API yet
        const sampleAccounts = [
            {
                id: 1,
                name: 'General Account',
                total_balance: 183904.39,
                hand_balance: 13458,
                bank_balance: 170446.4
            },
            {
                id: 2,
                name: 'Shoba Taleem E Murwaja',
                total_balance: 314503,
                hand_balance: 1500,
                bank_balance: 313003
            },
            {
                id: 3,
                name: 'Sahm E Imam & Sehm E Sadat',
                total_balance: 356321.15,
                hand_balance: 67042.06,
                bank_balance: 289279.08
            },
            {
                id: 4,
                name: 'Shoba Imdad Ul Mustahiqeen',
                total_balance: 801306.7,
                hand_balance: 401942,
                bank_balance: 399364.71
            }
        ];

        // Use sample data for now
        setAccounts(sampleAccounts);

        // Calculate total balance across all accounts
        const total = sampleAccounts.reduce((sum, account) => sum + account.total_balance, 0);
        setTotalBalance(total);

        // Sample monthly data
        generateChartData();

        // Simulate API call delay
        setTimeout(() => {
            setLoading(false);
        }, 1000);
    }, []);

    const generateChartData = () => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Generate revenue data with a slight upward trend
        const revenue = months.map((_, index) => {
            const base = 90000;
            const trend = index * 1000; // Upward trend
            const seasonal = Math.sin(index / 2) * 10000; // Seasonal variation
            const random = Math.random() * 10000; // Random noise
            return Math.floor(base + trend + seasonal + random);
        });

        // Generate expenses data with correlation to revenue but lower
        const expenses = revenue.map(value => Math.floor(value * (0.6 + Math.random() * 0.2)));

        // Generate income data (revenue - expenses)
        const income = revenue.map((value, index) => value - expenses[index]);

        setMonthlyData({
            labels: months,
            datasets: {
                revenue: [
                    {
                        label: 'Revenue',
                        data: revenue,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ],
                expenses: [
                    {
                        label: 'Expenses',
                        data: expenses,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ],
                income: [
                    {
                        label: 'Income',
                        data: income,
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            }
        });

        // Generate category data for doughnut chart
        setCategoryData({
            labels: ['Donations', 'Grants', 'Investments', 'Others'],
            datasets: [
                {
                    data: [45, 25, 20, 10],
                    backgroundColor: [
                        '#6366f1', // primary
                        '#22c55e', // success
                        '#f59e0b', // warning
                        '#64748b'  // secondary
                    ],
                    borderWidth: 0,
                    hoverOffset: 5
                }
            ]
        });
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(value);
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: 'rgba(226, 232, 240, 0.8)',
                borderWidth: 1,
                padding: 10,
                boxPadding: 8,
                usePointStyle: true,
                bodyFont: {
                    size: 12
                },
                titleFont: {
                    size: 13,
                    weight: 'bold'
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#94a3b8'
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(226, 232, 240, 0.5)'
                },
                ticks: {
                    color: '#94a3b8',
                    callback: function (value) {
                        return formatCurrency(value).replace('₹', '₹ ');
                    }
                }
            }
        },
        elements: {
            line: {
                borderWidth: 2
            },
            point: {
                radius: 0,
                hoverRadius: 6
            }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    padding: 15,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    color: '#64748b'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: 'rgba(226, 232, 240, 0.8)',
                borderWidth: 1,
                padding: 10,
                boxPadding: 8,
                usePointStyle: true,
                callbacks: {
                    label: function (context) {
                        let value = context.raw;
                        let total = context.dataset.data.reduce((a, b) => a + b, 0);
                        let percentage = Math.round((value / total) * 100) + '%';
                        return `${context.label}: ${percentage}`;
                    }
                }
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
                    <div className="mt-4 text-lg font-medium text-secondary-600 dark:text-secondary-400">Loading dashboard...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 md:space-y-8 animate-fadeIn">
            {/* Stats overview section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5">
                {/* Total Balance */}
                <div className="card p-4 md:p-5">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-secondary-500 dark:text-secondary-400">Total Balance</p>
                            <h3 className="text-xl md:text-2xl font-bold text-secondary-900 dark:text-white mt-1">
                                {formatCurrency(totalBalance)}
                            </h3>
                            <p className="text-xs text-success-600 dark:text-success-400 flex items-center mt-2">
                                <FaArrowUp className="mr-1" />
                                <span>7.2% from last month</span>
                            </p>
                        </div>
                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400 rounded-lg">
                            <FaMoneyBillWave className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                    </div>
                </div>

                {/* Hand Balance */}
                <div className="card p-4 md:p-5">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-secondary-500 dark:text-secondary-400">Hand Balance</p>
                            <h3 className="text-xl md:text-2xl font-bold text-secondary-900 dark:text-white mt-1">
                                {formatCurrency(accounts.reduce((sum, account) => sum + account.hand_balance, 0))}
                            </h3>
                            <p className="text-xs text-secondary-500 dark:text-secondary-400 flex items-center mt-2">
                                <span>{Math.round((accounts.reduce((sum, account) => sum + account.hand_balance, 0) / totalBalance) * 100)}% of total</span>
                            </p>
                        </div>
                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-success-50 dark:bg-success-900/20 text-success-500 dark:text-success-400 rounded-lg">
                            <FaHandHolding className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                    </div>
                </div>

                {/* Bank Balance */}
                <div className="card p-4 md:p-5">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-secondary-500 dark:text-secondary-400">Bank Balance</p>
                            <h3 className="text-xl md:text-2xl font-bold text-secondary-900 dark:text-white mt-1">
                                {formatCurrency(accounts.reduce((sum, account) => sum + account.bank_balance, 0))}
                            </h3>
                            <p className="text-xs text-secondary-500 dark:text-secondary-400 flex items-center mt-2">
                                <span>{Math.round((accounts.reduce((sum, account) => sum + account.bank_balance, 0) / totalBalance) * 100)}% of total</span>
                            </p>
                        </div>
                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-info-50 dark:bg-info-900/20 text-info-500 dark:text-info-400 rounded-lg">
                            <FaUniversity className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                    </div>
                </div>

                {/* Monthly Transactions */}
                <div className="card p-4 md:p-5">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-secondary-500 dark:text-secondary-400">Monthly Transactions</p>
                            <h3 className="text-xl md:text-2xl font-bold text-secondary-900 dark:text-white mt-1">
                                142
                            </h3>
                            <p className="text-xs text-danger-600 dark:text-danger-400 flex items-center mt-2">
                                <FaArrowDown className="mr-1" />
                                <span>3.1% from last month</span>
                            </p>
                        </div>
                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-secondary-50 dark:bg-secondary-700/30 text-secondary-500 dark:text-secondary-400 rounded-lg">
                            <FaExchangeAlt className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Accounts section */}
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-4">
                    <h2 className="text-lg md:text-xl font-semibold text-secondary-900 dark:text-white flex items-center">
                        <FaUniversity className="mr-2 text-primary-500 dark:text-primary-400" /> Accounts Overview
                    </h2>
                    <button className="mt-2 sm:mt-0 flex items-center text-sm text-primary-600 dark:text-primary-400 
                                       hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                        View All Accounts <FaArrowRight className="ml-1 text-xs" />
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {accounts.map(account => (
                        <AccountCard key={account.id} account={account} />
                    ))}
                </div>
            </div>

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-5">
                {/* Line chart - Financial trend */}
                <div className="card lg:col-span-2 p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-5 gap-2">
                        <h3 className="text-base md:text-lg font-semibold text-secondary-900 dark:text-white">Financial Overview</h3>
                        <div className="flex flex-wrap gap-2">
                            <div className="relative inline-flex">
                                <select
                                    value={selectedChart}
                                    onChange={(e) => setSelectedChart(e.target.value)}
                                    className="appearance-none bg-secondary-50 dark:bg-secondary-700/30 border border-secondary-200 dark:border-secondary-600 
                                              text-secondary-700 dark:text-secondary-300 rounded-lg py-1 pl-2 pr-8 text-sm focus:outline-none
                                              focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400"
                                >
                                    <option value="revenue">Revenue</option>
                                    <option value="expenses">Expenses</option>
                                    <option value="income">Net Income</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary-500 dark:text-secondary-400">
                                    <FaFilter size={10} />
                                </div>
                            </div>
                            <div className="relative inline-flex">
                                <select
                                    value={selectedPeriod}
                                    onChange={(e) => setSelectedPeriod(e.target.value)}
                                    className="appearance-none bg-secondary-50 dark:bg-secondary-700/30 border border-secondary-200 dark:border-secondary-600 
                                              text-secondary-700 dark:text-secondary-300 rounded-lg py-1 pl-2 pr-8 text-sm focus:outline-none
                                              focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400"
                                >
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="quarter">This Quarter</option>
                                    <option value="year">This Year</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary-500 dark:text-secondary-400">
                                    <FaCalendarAlt size={10} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="h-56 sm:h-64 md:h-72">
                        {monthlyData.labels && (
                            <Line
                                data={{
                                    labels: monthlyData.labels,
                                    datasets: monthlyData.datasets[selectedChart]
                                }}
                                options={chartOptions}
                            />
                        )}
                    </div>
                </div>

                {/* Doughnut chart - Income sources */}
                <div className="card p-4 md:p-5">
                    <h3 className="text-base md:text-lg font-semibold text-secondary-900 dark:text-white mb-4">Income Sources</h3>
                    <div className="h-52 md:h-60">
                        {categoryData.labels && (
                            <Doughnut
                                data={categoryData}
                                options={doughnutOptions}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Recent transactions */}
            <div className="card overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
                    <h3 className="text-base md:text-lg font-semibold text-secondary-900 dark:text-white flex items-center">
                        <FaExchangeAlt className="mr-2 text-primary-500 dark:text-primary-400" /> Recent Transactions
                    </h3>
                    <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                        View All
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
                        <thead className="bg-secondary-50 dark:bg-secondary-800">
                            <tr>
                                <th scope="col" className="px-3 md:px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                                    Transaction
                                </th>
                                <th scope="col" className="px-3 md:px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                                    Account
                                </th>
                                <th scope="col" className="px-3 md:px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                                    Date
                                </th>
                                <th scope="col" className="px-3 md:px-6 py-3 text-right text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                                    Amount
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-700">
                            {[1, 2, 3, 4, 5].map((item) => (
                                <tr key={item} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/50 transition-colors">
                                    <td className="px-3 md:px-6 py-3 whitespace-nowrap text-sm font-medium text-secondary-900 dark:text-white">
                                        Payment to Vendor
                                    </td>
                                    <td className="px-3 md:px-6 py-3 whitespace-nowrap text-sm text-secondary-700 dark:text-secondary-300">
                                        General Account
                                    </td>
                                    <td className="px-3 md:px-6 py-3 whitespace-nowrap text-sm text-secondary-700 dark:text-secondary-300">
                                        {new Date().toLocaleDateString()}
                                    </td>
                                    <td className="px-3 md:px-6 py-3 whitespace-nowrap text-sm text-right font-medium text-danger-600 dark:text-danger-400">
                                        -₹ 2,500
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Set the static page title
Home.pageTitle = 'Dashboard';

export default Home; 