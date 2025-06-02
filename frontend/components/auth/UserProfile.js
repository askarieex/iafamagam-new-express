import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import Link from 'next/link';

export default function UserProfile() {
    const { user, logout } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    if (!user) {
        return (
            <Link href="/auth/login" className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm2 0v14h12V3H5z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M11 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H7a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Sign In
            </Link>
        );
    }

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <Menu as="div" className="relative ml-3">
            <div>
                <Menu.Button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <span className="sr-only">Open user menu</span>
                    <div className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                </Menu.Button>
            </div>
            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <Menu.Item>
                        {({ active }) => (
                            <Link
                                href="/profile"
                                className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                    } block px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                            >
                                Your Profile
                            </Link>
                        )}
                    </Menu.Item>
                    {user.role === 'admin' && (
                        <Menu.Item>
                            {({ active }) => (
                                <Link
                                    href="/admin"
                                    className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                        } block px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                                >
                                    Admin Panel
                                </Link>
                            )}
                        </Menu.Item>
                    )}
                    <Menu.Item>
                        {({ active }) => (
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                    } block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50`}
                            >
                                {isLoggingOut ? 'Signing out...' : 'Sign out'}
                            </button>
                        )}
                    </Menu.Item>
                </Menu.Items>
            </Transition>
        </Menu>
    );
} 