import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import {
    FaTachometerAlt,
    FaMoneyBillWave,
    FaLayerGroup,
    FaExchangeAlt,
    FaHandHoldingUsd,
    FaBook,
    FaMoneyCheck,
    FaFileInvoiceDollar,
    FaCalendarAlt,
    FaChartBar,
    FaLock,
    FaUsers,
    FaCog,
    FaBookOpen,
    FaChevronLeft,
    FaMoon,
    FaSun,
    FaSignOutAlt,
    FaRegCreditCard,
    FaUserCog,
    FaQuestionCircle,
    FaChevronRight
} from 'react-icons/fa';

const Sidebar = ({ isOpen, toggleSidebar, lightMode = false }) => {
    const router = useRouter();
    const { hasPagePermission, user } = useAuth();
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Check if dark mode is enabled through localStorage or system preference
        const isDark = localStorage.getItem('darkMode') === 'true' ||
            (!('darkMode' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setIsDarkMode(isDark);
    }, []);

    const toggleDarkMode = () => {
        const newDarkMode = !isDarkMode;
        setIsDarkMode(newDarkMode);
        localStorage.setItem('darkMode', newDarkMode);
        document.documentElement.classList.toggle('dark', newDarkMode);
    };

    const menuItems = [
        {
            category: 'MAIN',
            items: [
                {
                    name: 'Dashboard',
                    path: '/dashboard',
                    icon: <FaTachometerAlt />,
                    permission: 'dashboard'
                },
                {
                    name: 'Accounts',
                    path: '/accounts',
                    icon: <FaMoneyBillWave />,
                    permission: 'accounts'
                }
            ]
        },
        {
            category: 'TRANSACTIONS',
            items: [
                {
                    name: 'Ledger Heads',
                    path: '/manage-ledger',
                    icon: <FaLayerGroup />,
                    permission: 'transactions'
                },
                {
                    name: 'Transactions',
                    path: '/transactions',
                    icon: <FaExchangeAlt />,
                    permission: 'transactions'
                },
                {
                    name: 'Donors',
                    path: '/donors',
                    icon: <FaHandHoldingUsd />,
                    permission: 'transactions'
                },
                {
                    name: 'Booklets',
                    path: '/booklets',
                    icon: <FaBook />,
                    permission: 'transactions'
                },
                {
                    name: 'Cheque Management',
                    path: '/cheque-management',
                    icon: <FaMoneyCheck />,
                    permission: 'transactions'
                }
            ]
        },
        {
            category: 'REPORTS',
            items: [
                {
                    name: 'Financial Reports',
                    path: '/reports',
                    icon: <FaFileInvoiceDollar />,
                    permission: 'reports'
                },
                {
                    name: 'Period Management',
                    path: '/period-management',
                    icon: <FaCalendarAlt />,
                    permission: 'reports'
                },
                {
                    name: 'Ledger Snapshots',
                    path: '/ledger-snapshots',
                    icon: <FaChartBar />,
                    permission: 'reports'
                },
                {
                    name: 'Donor Reports',
                    path: '/donor-reports',
                    icon: <FaUsers />,
                    permission: 'reports'
                }
            ]
        },
        {
            category: 'SYSTEM',
            items: [
                {
                    name: 'Settings',
                    path: '/settings',
                    icon: <FaCog />,
                    permission: 'settings'
                },
                {
                    name: 'Help & Docs',
                    path: '/help',
                    icon: <FaBookOpen />,
                    permission: null // Available to everyone
                }
            ]
        }
    ];

    // Don't render sidebar if no user is logged in
    if (!user) {
        return null;
    }

    return (
        <div className={`h-screen flex flex-col bg-white dark:bg-secondary-900 border-r border-gray-100 dark:border-secondary-800 ${isOpen ? 'w-60' : 'w-16'
            } transition-all duration-300`}>
            {/* Top header with logo and toggle button */}
            <div className="flex items-center justify-between h-[65px] px-4 border-b border-gray-100 dark:border-secondary-800">
                {isOpen ? (
                    <Link href="/" className="flex items-center">
                        <div className="h-8 w-8 bg-primary-600 rounded-md flex items-center justify-center text-white font-semibold">
                            IA
                        </div>
                        <div className="ml-2.5 text-sm font-bold text-secondary-900 dark:text-white">
                            IAFA Software
                        </div>
                    </Link>
                ) : (
                    <Link href="/" className="mx-auto">
                        <div className="h-8 w-8 bg-primary-600 rounded-md flex items-center justify-center text-white font-semibold">
                            IA
                        </div>
                    </Link>
                )}

                {isOpen && (
                    <button
                        onClick={toggleSidebar}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-secondary-800 text-secondary-500"
                        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                        <FaChevronLeft className={`w-3 h-3 transform transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {/* Navigation menu */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar">
                <nav className="py-2 px-1">
                    {menuItems.map((category, idx) => {
                        // Filter items based on user's permissions
                        const visibleItems = category.items.filter(item =>
                            // Show if no permission required or user has permission
                            item.permission === null || hasPagePermission(item.permission)
                        );

                        // Skip rendering this category if no items are visible
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={idx} className="px-3 py-1.5">
                                {isOpen && (
                                    <h3 className="text-[10px] font-medium tracking-wider text-secondary-400 dark:text-secondary-500 pb-1 mb-1">
                                        {category.category}
                                    </h3>
                                )}
                                <ul className="space-y-0.5">
                                    {visibleItems.map((item, itemIdx) => {
                                        const isActive = router.pathname === item.path;
                                        return (
                                            <li key={itemIdx}>
                                                <Link href={item.path} legacyBehavior>
                                                    <a className="block">
                                                        <div className={`flex items-center ${isOpen ? 'px-3 py-2' : 'py-2 justify-center'} rounded-md text-secondary-700 dark:text-secondary-400 
                                                                    text-xs font-medium transition-all duration-200 relative
                                                                    hover:bg-gray-50 dark:hover:bg-secondary-800/60 hover:text-secondary-900 dark:hover:text-white
                                                                    ${isActive ? 'bg-primary-50 dark:bg-secondary-800 text-primary-600 dark:text-primary-400 font-semibold' : ''}`}>
                                                            {isActive && (
                                                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-600 
                                                                            dark:bg-primary-500 rounded-r"></div>
                                                            )}
                                                            <div className={`${isOpen ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center flex-shrink-0`}>
                                                                {item.icon}
                                                            </div>
                                                            {isOpen && (
                                                                <span className="ml-2.5 whitespace-nowrap">
                                                                    {item.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </a>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="border-t border-gray-100 dark:border-secondary-800 p-2.5 bg-white dark:bg-secondary-900 flex-shrink-0">
                {isOpen ? (
                    <>
                        <button
                            className="flex items-center w-full justify-between p-1.5 rounded-md bg-gray-50
                                hover:bg-gray-100 dark:bg-secondary-800 dark:hover:bg-secondary-700 
                                text-secondary-600 dark:text-secondary-400 transition-colors duration-200 text-xs mb-2"
                            onClick={toggleDarkMode}
                            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            <div className="flex items-center">
                                {isDarkMode ? <FaSun className="text-yellow-300 w-3.5 h-3.5" /> : <FaMoon className="w-3.5 h-3.5" />}
                                <span className="ml-2">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                            </div>
                        </button>

                        <button className="flex items-center w-full px-3 py-1.5 rounded-md bg-gray-50 
                                hover:bg-gray-100 dark:bg-secondary-800 dark:hover:bg-secondary-700/70
                                text-red-500 dark:text-red-400 transition-colors duration-200 text-xs font-medium">
                            <FaSignOutAlt className="w-3.5 h-3.5" />
                            <span className="ml-2">Logout</span>
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center space-y-2">
                        <button
                            className="p-1.5 rounded-md bg-gray-50 hover:bg-gray-100 dark:bg-secondary-800 dark:hover:bg-secondary-700 
                                     text-secondary-600 dark:text-secondary-400"
                            onClick={toggleDarkMode}
                            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {isDarkMode ? <FaSun className="text-yellow-300 w-3.5 h-3.5" /> : <FaMoon className="w-3.5 h-3.5" />}
                        </button>

                        <button className="p-1.5 rounded-md bg-gray-50 hover:bg-gray-100 dark:bg-secondary-800 dark:hover:bg-secondary-700/70
                                         text-red-500 dark:text-red-400">
                            <FaSignOutAlt className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar; 