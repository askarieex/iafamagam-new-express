import Head from 'next/head';

export default function AuthLayout({ children, title }) {
    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content="IAFA Financial Management Software" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="w-full max-w-7xl mx-auto">
                    {children}
                </div>
            </div>
        </>
    );
} 