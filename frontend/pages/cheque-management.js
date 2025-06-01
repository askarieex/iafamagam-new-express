import React from 'react';
import Layout from '../components/Layout';
import ChequeManagement from '../components/cheques/ChequeManagement';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChequeManagementPage = () => {
    return (
        <Layout title="Cheque Management">
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                closeOnClick
                pauseOnHover
            />
            <ChequeManagement />
        </Layout>
    );
};

// Set the page title for Layout
ChequeManagementPage.pageTitle = 'Cheque Management';

export default ChequeManagementPage; 