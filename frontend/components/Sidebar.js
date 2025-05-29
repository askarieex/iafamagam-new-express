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
    FaBook
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
            category: 'Main',
            items: [
                { name: 'Dashboard', path: '/', icon: <FaChartLine /> },
                { name: 'Accounts', path: '/accounts', icon: <FaMoneyBillWave /> },
            ]
        },
        {
            category: 'Transactions',
            items: [
                { name: 'Ledger Heads', path: '/manage-ledger', icon: <FaLayerGroup /> },
                { name: 'Transactions', path: '/transactions', icon: <FaExchangeAlt /> },
                { name: 'Donors', path: '/donors', icon: <FaHandHoldingUsd /> },
                { name: 'Booklets', path: '/booklets', icon: <FaBook /> },
            ]
        },
        {
            category: 'Reports',
            items: [
                { name: 'Financial Reports', path: '/reports', icon: <FaFileInvoiceDollar /> },
                { name: 'Donor Reports', path: '/donor-reports', icon: <FaUsers /> },
            ]
        },
        {
            category: 'System',
            items: [
                { name: 'Settings', path: '/settings', icon: <FaCog /> },
                { name: 'Help & Docs', path: '/help', icon: <FaBookOpen /> },
            ]
        }
    ];

    return (
        <aside className={`sidebar ${isOpen ? 'open' : 'closed'} bg-white border-r border-gray-200`}>
            <div className="sidebar-header bg-blue-600 shadow-md">
                <h2 className="text-white font-semibold">
                    {isOpen ? 'IAFA Software' : 'IAFA'}
                </h2>
                <button
                    className="toggle-btn"
                    onClick={toggleSidebar}
                    aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                    <FaChevronLeft className={`transform transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <nav className="menu">
                {menuItems.map((category, idx) => (
                    <div key={idx} className="menu-category">
                        {isOpen && <h3 className="category-title text-gray-500 font-medium">{category.category}</h3>}
                        <ul>
                            {category.items.map((item, itemIdx) => {
                                const isActive = router.pathname === item.path;
                                return (
                                    <li key={itemIdx} className={isActive ? 'active' : ''}>
                                        <Link href={item.path} className="group">
                                            <div className={`menu-item ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'}`}>
                                                <span className={`icon ${isActive ? 'text-blue-500' : 'text-gray-500 group-hover:text-blue-500'}`}>{item.icon}</span>
                                                {isOpen && <span className="text">{item.name}</span>}
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="theme-toggle-container border-t border-gray-200">
                <button
                    className="theme-toggle bg-gray-100 text-gray-600 hover:bg-gray-200"
                    onClick={toggleDarkMode}
                    aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDarkMode ? <FaSun /> : <FaMoon />}
                </button>
            </div>

            <div className="logout-btn-container border-t border-gray-200">
                <button className="logout-btn bg-red-500 hover:bg-red-600 text-white gap-2">
                    <FaSignOutAlt />
                    {isOpen && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar; 