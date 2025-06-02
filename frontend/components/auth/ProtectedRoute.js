import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';

/**
 * Component to protect routes that require authentication
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @param {string|string[]} [props.requiredRole] - Role(s) required to access the route
 * @param {string} [props.requiredPermission] - Specific page permission required (e.g., 'dashboard', 'transactions')
 * @param {string} [props.redirectTo='/auth/login'] - Where to redirect if not authenticated
 */
export default function ProtectedRoute({
    children,
    requiredRole = null,
    requiredPermission = null,
    redirectTo = '/auth/login'
}) {
    const { user, loading, hasRole, hasPagePermission } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Wait until auth state is loaded
        if (loading) return;

        console.log("ProtectedRoute check:", {
            user: user ? `${user.name} (${user.email})` : 'Not logged in',
            userRole: user?.role,
            requiredRole,
            hasRequiredRole: user ? hasRole(requiredRole) : false,
            requiredPermission,
            hasRequiredPermission: user ? hasPagePermission(requiredPermission) : false
        });

        // If no user is logged in, redirect to login page
        if (!user) {
            console.log("No user logged in, redirecting to:", redirectTo);
            router.push(redirectTo);
            return;
        }

        // If specific role is required, check if user has it
        if (requiredRole && !hasRole(requiredRole)) {
            console.log(`User lacks required role: ${requiredRole}, redirecting to /unauthorized`);
            router.push('/unauthorized');
            return;
        }

        // If specific page permission is required, check if user has it
        if (requiredPermission && !hasPagePermission(requiredPermission)) {
            console.log(`User lacks required permission: ${requiredPermission}, redirecting to /unauthorized`);
            router.push('/unauthorized');
            return;
        }

        console.log("User has all required permissions/roles");
    }, [user, loading, requiredRole, requiredPermission, router, redirectTo, hasRole, hasPagePermission]);

    // Show nothing while loading or redirecting
    if (loading || !user ||
        (requiredRole && !hasRole(requiredRole)) ||
        (requiredPermission && !hasPagePermission(requiredPermission))) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // If authenticated and has required role/permission, render children
    return <>{children}</>;
} 