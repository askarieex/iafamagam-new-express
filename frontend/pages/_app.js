import '../styles/globals.css';
import MainLayout from '../layouts/MainLayout';
import dynamic from 'next/dynamic';
import 'react-toastify/dist/ReactToastify.css';

// Import ToastContainer with SSR disabled
const ToastContainer = dynamic(
    () => import('react-toastify').then((mod) => mod.ToastContainer),
    { ssr: false }
);

function MyApp({ Component, pageProps }) {
    // Get the page title from the Component if available
    const pageTitle = Component.pageTitle || 'IAFA Software';

    return (
        <MainLayout title={pageTitle}>
            <ToastContainer position="top-right" autoClose={3000} />
            <Component {...pageProps} />
        </MainLayout>
    );
}

export default MyApp; 