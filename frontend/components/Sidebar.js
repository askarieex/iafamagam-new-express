import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    FaChartLine,
    FaMoneyBillWave,
    FaExchangeAlt,
    FaUsers,
    FaCog,
    FaBookOpen,
    FaSignOutAlt,
    FaChevronLeft,
    FaMoon,
    FaSun,
    FaFileInvoiceDollar,
    FaHandHoldingUsd,
    FaLayerGroup,
    FaBook,
    FaMoneyCheck,
    FaTachometerAlt,
    FaCalendarAlt,
    FaLock,
    FaChartBar
} from 'react-icons/fa';

const Sidebar = ({ isOpen, toggleSidebar, lightMode = false }) => {
    const router = useRouter();
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Check if dark mode is enabled, prioritize props
        if (lightMode) {
            setIsDarkMode(false);
            document.body.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        } else {
            const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
            setIsDarkMode(darkModeEnabled);

            if (darkModeEnabled) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        }
    }, [lightMode]);

    const toggleDarkMode = () => {
        const newDarkMode = !isDarkMode;
        setIsDarkMode(newDarkMode);
        localStorage.setItem('darkMode', newDarkMode);

        if (newDarkMode) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    };

    const menuItems = [
        {
            category: 'MAIN',
            items: [
                { name: 'Dashboard', path: '/', icon: <FaTachometerAlt /> },
                { name: 'Accounts', path: '/accounts', icon: <FaMoneyBillWave /> },
            ]
        },
        {
            category: 'TRANSACTIONS',
            items: [
                { name: 'Ledger Heads', path: '/manage-ledger', icon: <FaLayerGroup /> },
                { name: 'Transactions', path: '/transactions', icon: <FaExchangeAlt /> },
                { name: 'Donors', path: '/donors', icon: <FaHandHoldingUsd /> },
                { name: 'Booklets', path: '/booklets', icon: <FaBook /> },
                { name: 'Cheque Management', path: '/cheque-management', icon: <FaMoneyCheck /> },
            ]
        },
        {
            category: 'REPORTS',
            items: [
                { name: 'Financial Reports', path: '/reports', icon: <FaFileInvoiceDollar /> },
                { name: 'Monthly Reports', path: '/monthly-reports', icon: <FaCalendarAlt /> },
                { name: 'Ledger Snapshots', path: '/ledger-snapshots', icon: <FaChartBar /> },
                { name: 'Period Closure', path: '/period-closure', icon: <FaLock /> },
                { name: 'Donor Reports', path: '/donor-reports', icon: <FaUsers /> },
            ]
        },
        {
            category: 'SYSTEM',
            items: [
                { name: 'Settings', path: '/settings', icon: <FaCog /> },
                { name: 'Help & Docs', path: '/help', icon: <FaBookOpen /> },
            ]
        }
    ];

    return (
        <div className={`fixed top-0 left-0 h-full bg-white dark:bg-secondary-900 
                        border-r border-gray-100 dark:border-secondary-800 transform transition-all duration-300 ease-in-out
                        shadow-sm z-40 flex flex-col
                        ${isOpen ? 'translate-x-0 w-60' : 'lg:w-16 lg:translate-x-0 -translate-x-full'}`}>
            {/* Sidebar Header */}
            <div className="h-[60px] flex items-center justify-between px-3 border-b border-gray-100 dark:border-secondary-800 flex-shrink-0">
                <div className="flex items-center overflow-hidden">
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary-600 text-white text-base font-bold flex-shrink-0">
                        <span>IAFA</span>
                    </div>
                    <div className={`ml-2 transition-all duration-300 overflow-hidden ${!isOpen && 'lg:opacity-0 lg:w-0'}`}>
                        <span className="font-semibold text-secondary-800 dark:text-white text-sm whitespace-nowrap">IAFA Software</span>
                        <span className="text-[10px] text-secondary-500 dark:text-secondary-400 block whitespace-nowrap">Financial Management</span>
                    </div>
                </div>
                <button
                    className="p-1.5 rounded-md bg-gray-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400 
                            hover:bg-gray-200 dark:hover:bg-secondary-700 transition-colors duration-200 flex-shrink-0"
                    onClick={toggleSidebar}
                    aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                    <FaChevronLeft className={`w-3 h-3 transform transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Sidebar Content - Scrollable Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar">
                <nav className="py-2 px-1">
                    {menuItems.map((category, idx) => (
                        <div key={idx} className="px-3 py-1.5">
                            {isOpen && (
                                <h3 className="text-[10px] font-medium tracking-wider text-secondary-400 dark:text-secondary-500 pb-1 mb-1">
                                    {category.category}
                                </h3>
                            )}
                            <ul className="space-y-0.5">
                                {category.items.map((item, itemIdx) => {
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
                    ))}
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