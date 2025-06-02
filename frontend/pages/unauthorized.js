import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

// Set page title
UnauthorizedPage.pageTitle = 'Unauthorized Access';

export default function UnauthorizedPage() {
    const router = useRouter();
    const { user } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8 max-w-md w-full text-center">
                <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unauthorized Access</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {user
                        ? `You don't have permission to access this page. Your current role is ${user.role}.`
                        : 'You need to be logged in to access this page.'}
                </p>

                <div className="flex flex-col space-y-3">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Go to Dashboard
                    </button>

                    {!user && (
                        <button
                            onClick={() => router.push('/auth/login')}
                            className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                            Log In
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
} 