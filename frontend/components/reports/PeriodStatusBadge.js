import React from 'react';
import { FaLock, FaLockOpen } from 'react-icons/fa';

/**
 * A reusable badge component to show if an accounting period is open or closed
 * @param {boolean} isOpen - Whether the period is open (true) or closed (false)
 * @param {string} size - Size of the badge ('sm' or 'md')
 * @param {boolean} showText - Whether to show the text label
 */
const PeriodStatusBadge = ({ isOpen = true, size = 'md', showText = true }) => {
    // Determine classes based on size
    const sizeClasses = size === 'sm'
        ? 'px-1.5 py-0.5 text-xs'
        : 'px-2.5 py-0.5 text-xs';

    if (isOpen) {
        return (
            <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium bg-green-100 text-green-800`}>
                <FaLockOpen className={`${showText ? 'mr-1' : ''}`} size={size === 'sm' ? 10 : 12} />
                {showText && 'Open'}
            </span>
        );
    } else {
        return (
            <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium bg-gray-100 text-gray-800`}>
                <FaLock className={`${showText ? 'mr-1' : ''}`} size={size === 'sm' ? 10 : 12} />
                {showText && 'Closed'}
            </span>
        );
    }
};

export default PeriodStatusBadge; 