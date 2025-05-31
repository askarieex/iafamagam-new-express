import React from 'react';
import { FaCheck, FaTimes, FaClock } from 'react-icons/fa';

const TransactionStatusBadge = ({ status }) => {
    let color, icon, text;

    switch (status) {
        case 'pending':
            color = 'bg-yellow-100 text-yellow-800';
            icon = <FaClock className="mr-1" />;
            text = 'Pending';
            break;
        case 'completed':
            color = 'bg-green-100 text-green-800';
            icon = <FaCheck className="mr-1" />;
            text = 'Completed';
            break;
        case 'cancelled':
            color = 'bg-red-100 text-red-800';
            icon = <FaTimes className="mr-1" />;
            text = 'Cancelled';
            break;
        default:
            color = 'bg-gray-100 text-gray-800';
            icon = null;
            text = status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown';
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
            {icon}
            {text}
        </span>
    );
};

export default TransactionStatusBadge; 