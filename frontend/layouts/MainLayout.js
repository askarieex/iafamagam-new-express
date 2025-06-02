import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import { FaBars } from 'react-icons/fa';
import UserProfile from '../components/auth/UserProfile';
import { useAuth } from '../hooks/useAuth';

const MainLayout = ({ children, title = 'IAFA Software' }) => {
    const { user } = useAuth();
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

    // If user is not logged in, render a simpler layout without sidebar
    if (!user) {
        return (
            <>
                <Head>
                    <title>{title}</title>
                    <meta name="description" content="IAFA Financial Management Software" />
                    <link rel="icon" href="/favicon.ico" />
                </Head>
                <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                    <div className="max-w-full mx-auto">
                        {children}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content="IAFA Financial Management Software" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="flex h-screen overflow-hidden">
                    {/* Mobile menu overlay */}
                    {mobileMenuOpen && (
                        <div
                            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                            onClick={toggleMobileMenu}
                            aria-hidden="true"
                        />
                    )}

                    {/* Sidebar */}
                    <div className={`fixed z-30 ${mobileMenuOpen ? 'block' : 'hidden'} lg:block h-full`}>
                        <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
                    </div>

                    {/* Main content area */}
                    <div className={`flex flex-col flex-1 ${sidebarOpen ? 'ml-60' : 'ml-16'} transition-all duration-300`}>
                        {/* Top navigation bar */}
                        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 h-16 sticky top-0 z-20 flex items-center">
                            <div className="flex items-center justify-between h-full w-full px-4 md:px-6">
                                {/* Mobile menu button */}
                                <button
                                    className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    onClick={toggleMobileMenu}
                                    aria-label="Open sidebar"
                                >
                                    <FaBars className="w-4 h-4" />
                                </button>

                                {/* Page title */}
                                <h1 className="text-base lg:text-lg font-semibold text-gray-800 dark:text-white">
                                    {title}
                                </h1>

                                {/* User profile/actions */}
                                <div className="flex items-center gap-3">
                                    <UserProfile />
                                </div>
                            </div>
                        </header>

                        {/* Main content */}
                        <main className="flex-1 p-4 overflow-auto">
                            {children}
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MainLayout; 