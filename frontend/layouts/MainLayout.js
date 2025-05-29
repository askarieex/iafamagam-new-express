import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import { FaBars } from 'react-icons/fa';

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

            <div className="layout bg-gray-50">
                {/* Mobile menu overlay */}
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-gray-500/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                        onClick={toggleMobileMenu}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar - hidden on mobile unless toggled */}
                <div className={`lg:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
                    <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} lightMode={true} />
                </div>

                {/* Main content area */}
                <div className={`main-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                    {/* Top navigation bar */}
                    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between h-16 px-4 md:px-6">
                            {/* Mobile menu button */}
                            <button
                                className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
                                onClick={toggleMobileMenu}
                                aria-label="Open sidebar"
                            >
                                <FaBars className="h-5 w-5" />
                            </button>

                            {/* Page title - shown on mobile only */}
                            <div className="lg:hidden font-semibold text-gray-900">{title}</div>

                            {/* User profile/actions placeholder */}
                            <div className="flex items-center space-x-4">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                                    A
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Main content */}
                    <main className="content bg-gray-50">
                        {/* Page header */}
                        <div className="mb-6 hidden lg:block">
                            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
                        </div>

                        {/* Page content */}
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
};

export default MainLayout; 