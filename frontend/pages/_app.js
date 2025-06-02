import '../styles/globals.css';
import '../styles/sidebar.css';
import MainLayout from '../layouts/MainLayout';
import dynamic from 'next/dynamic';
import 'react-toastify/dist/ReactToastify.css';
import { useRouter } from 'next/router';

// Import ToastContainer with SSR disabled
const ToastContainer = dynamic(
    () => import('react-toastify').then((mod) => mod.ToastContainer),
    { ssr: false }
);

function MyApp({ Component, pageProps }) {
    // Get the page title from the Component if available
    const pageTitle = Component.pageTitle || 'IAFA Software';
    const router = useRouter();

    // Special cases for certain pages
    const isChequeManagementPage = router.pathname === '/cheque-management';

    if (isChequeManagementPage) {
        // Don't wrap the cheque management page with layout or toast container
        return <Component {...pageProps} />;
    }

    return (
        <MainLayout title={pageTitle}>
            <ToastContainer position="top-right" autoClose={3000} />
            <Component {...pageProps} />
        </MainLayout>
    );
}

export default MyApp; 