import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import { FaBars, FaUserCircle } from 'react-icons/fa';

const Layout = ({ children, title = 'IAFA Software' }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true); // Default to open on desktop
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Handle sidebar toggle
    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    // Handle mobile menu toggle
    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    // Close mobile menu on window resize and adjust sidebar for desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setMobileMenuOpen(false);
                setSidebarOpen(true); // Keep sidebar open on desktop
            } else {
                setSidebarOpen(false); // Close on mobile
            }
        };

        // Initial check
        handleResize();

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
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            </Head>

            <div className="h-screen bg-background-light dark:bg-background-dark overflow-hidden">
                {/* Mobile menu overlay */}
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 lg:hidden"
                        onClick={toggleMobileMenu}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar */}
                <Sidebar
                    isOpen={sidebarOpen}
                    toggleSidebar={toggleSidebar}
                    lightMode={true}
                />

                {/* Main content area */}
                <div
                    className={`flex flex-col h-full transition-all duration-300 ease-in-out
                              ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}
                >
                    {/* Top navigation bar */}
                    <header className="bg-white dark:bg-secondary-900 shadow-sm border-b border-gray-100 dark:border-secondary-800 h-[65px] sticky top-0 z-30 flex items-center">
                        <div className="flex items-center justify-between h-full w-full px-4 md:px-6">
                            {/* Mobile menu button */}
                            <button
                                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-secondary-600 dark:text-secondary-400 hover:bg-gray-100 dark:hover:bg-secondary-800 transition-colors"
                                onClick={toggleMobileMenu}
                                aria-label="Open sidebar"
                            >
                                <FaBars className="w-4 h-4" />
                            </button>

                            {/* Page title */}
                            <h1 className="text-base lg:text-lg font-semibold text-secondary-800 dark:text-white">
                                {title}
                            </h1>

                            {/* User profile/actions */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                                    <FaUserCircle className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Main content with improved scrolling */}
                    <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-3 sm:p-4 md:p-6">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
};

export default Layout; 