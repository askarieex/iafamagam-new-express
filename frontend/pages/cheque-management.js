import React from 'react';
import Layout from '../components/Layout';
import ChequeManagement from '../components/cheques/ChequeManagement';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChequeManagementPage = () => {
    return (
        <Layout>
            <ToastContainer position="top-right" autoClose={3000} />
            <ChequeManagement />
        </Layout>
    );
};

export default ChequeManagementPage; 