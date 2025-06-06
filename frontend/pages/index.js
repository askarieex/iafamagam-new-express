import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import Head from 'next/head';

export default function HomePage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    // Redirect logic based on authentication status
    useEffect(() => {
        if (!loading) {
            if (user) {
                // If user is authenticated, redirect to dashboard
                router.replace('/dashboard');
            } else {
                // If user is not authenticated, redirect to login
                router.replace('/auth/login');
            }
        }
    }, [loading, user, router]);

    // Show loading indicator while checking auth status
    return (
        <>
            <Head>
                <title>IAFA Software</title>
            </Head>
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold text-gray-700">Loading IAFA Software...</h2>
                </div>
            </div>
        </>
    );
} 