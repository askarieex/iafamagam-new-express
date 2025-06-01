import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import { FaBars, FaUserCircle } from 'react-icons/fa';

const MainLayout = ({ children, title = 'IAFA Software' }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Handle sidebar toggle
    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    // Handle mobile menu toggle
    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    // Close mobile menu on window resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setMobileMenuOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content="IAFA Software - Financial management system" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className="app-layout">
                {/* Mobile menu overlay */}
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                        onClick={toggleMobileMenu}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar - hidden on mobile unless toggled */}
                <div className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block`}>
                    <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} lightMode={true} />
                </div>

                {/* Main content area */}
                <div className={`main-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                    {/* Top navigation bar */}
                    <header className="app-header">
                        <div className="header-container">
                            {/* Mobile menu button */}
                            <button
                                className="mobile-menu-btn"
                                onClick={toggleMobileMenu}
                                aria-label="Open sidebar"
                            >
                                <FaBars />
                            </button>

                            {/* Page title */}
                            <h1 className="page-title">
                                {title}
                            </h1>

                            {/* User profile/actions */}
                            <div className="user-profile">
                                <div className="avatar">
                                    <FaUserCircle />
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Main content */}
                    <main className="content">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
};

export default MainLayout; 