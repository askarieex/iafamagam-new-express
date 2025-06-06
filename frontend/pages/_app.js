import '../styles/globals.css';
import '../styles/sidebar.css';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import dynamic from 'next/dynamic';
import 'react-toastify/dist/ReactToastify.css';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

// Import ToastContainer with SSR disabled
const ToastContainer = dynamic(
    () => import('react-toastify').then((mod) => mod.ToastContainer),
    { ssr: false }
);

// List of public routes that don't require authentication
const publicRoutes = ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/forgot-password', '/auth/debug-tools'];

function AppContent({ Component, pageProps }) {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isReady, setIsReady] = useState(false);

    // Get the page title from the Component if available
    const pageTitle = Component.pageTitle || 'IAFA Software';

    // Special cases for certain pages
    const isChequeManagementPage = router.pathname === '/cheque-management';
    const isAuthPage = publicRoutes.includes(router.pathname);
    const isHomePage = router.pathname === '/';

    // Handle authentication and redirects
    useEffect(() => {
        // Skip redirect logic for home page as it handles its own redirects
        if (isHomePage) return;

        // Only perform redirects when loading is complete
        if (!loading) {
            // Check if user is NOT authenticated and NOT on an auth page (like login)
            if (!user && !isAuthPage) {
                console.log('Redirecting unauthenticated user to login page');
                router.replace('/auth/login');
            } else if (user && isAuthPage) {
                // If user is authenticated and tries to access login page, redirect to dashboard
                console.log('Redirecting authenticated user to dashboard');
                router.replace('/dashboard');
            } else {
                // Mark as ready once authentication check is complete
                setIsReady(true);
            }
        }
    }, [user, loading, router.pathname, isAuthPage, isHomePage]);

    // Show loading state while checking authentication
    if (loading || (!isReady && !isAuthPage && !isHomePage)) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Home page, auth pages, and cheque management page don't need a layout wrapper
    if (isHomePage || isChequeManagementPage) {
        return <Component {...pageProps} />;
    }

    // Auth pages use the simpler AuthLayout
    if (isAuthPage) {
        return (
            <AuthLayout title={pageTitle}>
                <Toaster position="top-right" />
                <Component {...pageProps} />
            </AuthLayout>
        );
    }

    // All other pages use MainLayout (which has its own auth check)
    return (
        <MainLayout title={pageTitle}>
            <Toaster position="top-right" />
            <Component {...pageProps} />
        </MainLayout>
    );
}

function MyApp({ Component, pageProps }) {
    return (
        <AuthProvider>
            <AppContent Component={Component} pageProps={pageProps} />
        </AuthProvider>
    );
}

export default MyApp; 