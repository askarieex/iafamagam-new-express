import React from 'react';
import MainLayout from '../layouts/MainLayout';

const Layout = ({ children, title }) => {
    return (
        <MainLayout title={title}>
            {children}
        </MainLayout>
    );
};

export default Layout; 