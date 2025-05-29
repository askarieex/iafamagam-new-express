import React, { useState, useEffect } from 'react';
import { FaPlus, FaTimes, FaBook, FaEdit, FaTrash, FaSave, FaFilter, FaEye, FaUndo } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

// Helper function to format dates safely
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
        // First check if we received a valid date string
        if (typeof dateString !== 'string' && !(dateString instanceof Date)) {
            console.log("Invalid date type:", typeof dateString, dateString);
            return 'N/A';
        }

        // Clean the date string to handle timezone issues
        let cleanDateString;
        if (typeof dateString === 'string') {
            // Remove timezone part if it's causing issues
            cleanDateString = dateString.replace(/\s\+\d{4}$/, '');
        } else {
            cleanDateString = dateString;
        }

        // Try to create a date object
        const date = new Date(cleanDateString);

        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.log("Invalid date after parsing:", cleanDateString);

            // Try alternative parsing for format like "2025-05-05 12:13:13.306 +0530"
            if (typeof dateString === 'string') {
                const parts = dateString.split(' ');
                if (parts.length >= 2) {
                    const datePart = parts[0]; // "2025-05-05"

                    const [year, month, day] = datePart.split('-').map(Number);
                    // JavaScript months are 0-indexed, so we need to subtract 1
                    const fixedDate = new Date(year, month - 1, day);

                    if (!isNaN(fixedDate.getTime())) {
                        return fixedDate.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        });
                    }
                }
            }
            return 'N/A';
        }

        // Format date as DD/MM/YYYY
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error("Error formatting date:", error, dateString);
        return 'N/A';
    }
};

const BookletsPage = () => {
    const [booklets, setBooklets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [formData, setFormData] = useState({
        booklet_no: '',
        start_no: '',
        end_no: ''
    });
    const [editData, setEditData] = useState({
        id: null,
        booklet_no: '',
        start_no: '',
        end_no: '',
        pages_left: []
    });
    const [filterActive, setFilterActive] = useState(false);
    const [viewingBooklet, setViewingBooklet] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);

    useEffect(() => {
        fetchBooklets();
    }, [filterActive]);

    const fetchBooklets = async () => {
        try {
            setLoading(true);
            const url = filterActive
                ? `${API_URL}/booklets?active=true`
                : `${API_URL}/booklets`;

            const response = await axios.get(url);

            // Debug data to see what format dates are in
            if (response.data.data.length > 0) {
                console.log("Example Booklet Raw Data:", response.data.data[0]);
                console.log("Created At Type:", typeof response.data.data[0].createdAt);
                console.log("Created At Value:", response.data.data[0].createdAt);

                // Try to manually format the date
                const testDate = new Date(response.data.data[0].createdAt);
                console.log("Parsed Date:", testDate);
                console.log("Formatted Date:", testDate.toLocaleDateString('en-GB'));
            }

            setBooklets(response.data.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching booklets:', error);
            toast.error('Failed to fetch booklets');
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleEditInputChange = (e) => {
        setEditData({
            ...editData,
            [e.target.name]: e.target.value
        });
    };

    const validateForm = (data) => {
        if (!data.booklet_no) {
            toast.error('Booklet number is required');
            return false;
        }
        if (!data.start_no || isNaN(parseInt(data.start_no))) {
            toast.error('Valid start number is required');
            return false;
        }
        if (!data.end_no || isNaN(parseInt(data.end_no))) {
            toast.error('Valid end number is required');
            return false;
        }
        if (parseInt(data.end_no) <= parseInt(data.start_no)) {
            toast.error('End number must be greater than start number');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm(formData)) return;

        try {
            setLoading(true);
            const response = await axios.post(`${API_URL}/booklets`, formData);

            // Check if any receipt numbers were excluded
            if (response.data.excludedReceiptNumbers && response.data.excludedReceiptNumbers.length > 0) {
                toast.info(`Booklet created successfully, but some receipt numbers were excluded because they are already used in transactions: ${response.data.excludedReceiptNumbers.join(', ')}`);
            } else {
                toast.success('Booklet created successfully');
            }

            setShowModal(false);
            setFormData({
                booklet_no: '',
                start_no: '',
                end_no: ''
            });
            fetchBooklets();
        } catch (error) {
            console.error('Error creating booklet:', error);
            toast.error(error.response?.data?.message || 'Failed to create booklet');
            setLoading(false);
        }
    };

    const handleEdit = (booklet) => {
        setEditData({
            id: booklet.id,
            booklet_no: booklet.booklet_no,
            start_no: booklet.start_no,
            end_no: booklet.end_no,
            pages_left: booklet.pages_left
        });
        setShowEditModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!validateForm(editData)) return;

        try {
            setLoading(true);

            // Check if warning should be shown about pages_left
            const startNoChanged = parseInt(editData.start_no) !== booklets.find(b => b.id === editData.id).start_no;
            const endNoChanged = parseInt(editData.end_no) !== booklets.find(b => b.id === editData.id).end_no;

            if (startNoChanged || endNoChanged) {
                if (!confirm("Warning: Changing start or end numbers will regenerate the booklet's available pages. This may exclude receipt numbers already used in transactions. Continue?")) {
                    setLoading(false);
                    return;
                }
            }

            const response = await axios.put(`${API_URL}/booklets/${editData.id}`, {
                booklet_no: editData.booklet_no,
                start_no: editData.start_no,
                end_no: editData.end_no
            });

            toast.success('Booklet updated successfully');
            setShowEditModal(false);
            fetchBooklets();
        } catch (error) {
            console.error('Error updating booklet:', error);
            toast.error(error.response?.data?.message || 'Failed to update booklet');
            setLoading(false);
        }
    };

    const handleDeleteConfirm = (id) => {
        setConfirmDelete(id);
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;

        try {
            setLoading(true);
            const response = await axios.delete(`${API_URL}/booklets/${confirmDelete}`);

            // Check if any transactions were preserved
            if (response.data.transactionsPreserved > 0) {
                toast.info(`Booklet deleted successfully. ${response.data.transactionsPreserved} transactions were preserved and detached from this booklet.`);
            } else {
                toast.success('Booklet deleted successfully');
            }

            setConfirmDelete(null);
            fetchBooklets();
        } catch (error) {
            console.error('Error deleting booklet:', error);
            toast.error(error.response?.data?.message || 'Failed to delete booklet');
            setLoading(false);
        }
    };

    const handleCloseBooklet = async (id) => {
        if (!confirm('Are you sure you want to close this booklet?')) return;

        try {
            setLoading(true);
            await axios.patch(`${API_URL}/booklets/${id}/close`);
            toast.success('Booklet closed successfully');
            fetchBooklets();
        } catch (error) {
            console.error('Error closing booklet:', error);
            toast.error(error.response?.data?.message || 'Failed to close booklet');
            setLoading(false);
        }
    };

    const handleViewBooklet = async (id) => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/booklets/${id}`);
            setViewingBooklet(response.data.data);
            setShowViewModal(true);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching booklet:', error);
            toast.error('Failed to fetch booklet details');
            setLoading(false);
        }
    };

    const handleReactivateBooklet = async (id) => {
        try {
            toast.error('Booklet reactivation has been disabled to prevent duplicate receipt number errors');
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const toggleFilter = () => {
        setFilterActive(!filterActive);
    };

    return (
        <div className="page-container">
            {/* Single clear page header */}
            <div className="page-header mb-6">
                <div className="flex items-center">
                    <FaBook className="mr-2 text-blue-600 text-xl" />
                    <h1 className="text-2xl font-semibold">Manage Booklets</h1>
                </div>
            </div>

            <div className="flex items-center justify-end mb-4">
                <div className="flex gap-2">
                    <button
                        className="filter-btn py-2 px-3 flex items-center justify-center"
                        onClick={toggleFilter}
                    >
                        <FaFilter className="mr-2" />
                        {filterActive ? 'All Booklets' : 'Active Only'}
                    </button>
                    <button
                        className="add-btn py-2 px-3 flex items-center justify-center"
                        onClick={() => setShowModal(true)}
                    >
                        <FaPlus className="mr-2" />
                        Add Booklet
                    </button>
                </div>
            </div>

            <div className="bg-secondary-800 rounded-lg overflow-hidden shadow">
                <div className="p-4">
                    <h3 className="mb-2 text-white flex items-center">
                        All Booklets
                        <span className="count-badge ml-2">{booklets.length}</span>
                    </h3>

                    {loading ? (
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                            <p>Loading booklets...</p>
                        </div>
                    ) : booklets.length === 0 ? (
                        <div className="no-data">
                            <FaBook className="no-data-icon" />
                            <p>No booklets found</p>
                            <button
                                className="add-btn-secondary"
                                onClick={() => setShowModal(true)}
                            >
                                <FaPlus className="mr-1" />
                                Add New Booklet
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left bg-secondary-700 text-white">
                                        <th className="p-2 border-b border-secondary-600">ID</th>
                                        <th className="p-2 border-b border-secondary-600">Booklet No</th>
                                        <th className="p-2 border-b border-secondary-600">Start No</th>
                                        <th className="p-2 border-b border-secondary-600">End No</th>
                                        <th className="p-2 border-b border-secondary-600">Pages Left</th>
                                        <th className="p-2 border-b border-secondary-600">Status</th>
                                        <th className="p-2 border-b border-secondary-600">Created At</th>
                                        <th className="p-2 border-b border-secondary-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-white">
                                    {booklets.map((booklet) => (
                                        <tr key={booklet.id} className={!booklet.is_active ? 'inactive-row' : 'border-b border-secondary-700'}>
                                            <td className="p-2">{booklet.id}</td>
                                            <td className="p-2">{booklet.booklet_no}</td>
                                            <td className="p-2">{booklet.start_no}</td>
                                            <td className="p-2">{booklet.end_no}</td>
                                            <td className="p-2">
                                                <span className="pages-badge">
                                                    {booklet.pages_left.length}
                                                </span>
                                            </td>
                                            <td className="p-2">
                                                <span className={`status-badge ${booklet.is_active ? 'active' : 'inactive'}`}>
                                                    {booklet.is_active ? 'Active' : 'Closed'}
                                                </span>
                                            </td>
                                            <td className="p-2">{formatDate(booklet.createdAt)}</td>
                                            <td className="p-2">
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-view"
                                                        onClick={() => handleViewBooklet(booklet.id)}
                                                        title="View Details"
                                                    >
                                                        <FaEye />
                                                    </button>

                                                    {booklet.is_active ? (
                                                        <>
                                                            <button
                                                                className="btn-edit"
                                                                onClick={() => handleEdit(booklet)}
                                                                title="Edit Booklet"
                                                            >
                                                                <FaEdit />
                                                            </button>
                                                            <button
                                                                className="btn-close"
                                                                onClick={() => handleCloseBooklet(booklet.id)}
                                                                title="Close Booklet"
                                                            >
                                                                <FaTimes />
                                                            </button>
                                                            <button
                                                                className="btn-delete"
                                                                onClick={() => handleDeleteConfirm(booklet.id)}
                                                                title="Delete Booklet"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                className="btn-delete"
                                                                onClick={() => handleDeleteConfirm(booklet.id)}
                                                                title="Delete Booklet"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Booklet Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                <FaBook className="mr-2" />
                                Add New Booklet
                            </h2>
                            <button
                                className="close-modal-btn"
                                onClick={() => setShowModal(false)}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label htmlFor="booklet_no">Booklet Number <span className="required">*</span></label>
                                <input
                                    type="text"
                                    id="booklet_no"
                                    name="booklet_no"
                                    value={formData.booklet_no}
                                    onChange={handleInputChange}
                                    placeholder="e.g. BK-2023-001"
                                    className="form-input"
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="start_no">Start Number <span className="required">*</span></label>
                                    <input
                                        type="number"
                                        id="start_no"
                                        name="start_no"
                                        value={formData.start_no}
                                        onChange={handleInputChange}
                                        placeholder="e.g. 1"
                                        className="form-input"
                                        min="1"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="end_no">End Number <span className="required">*</span></label>
                                    <input
                                        type="number"
                                        id="end_no"
                                        name="end_no"
                                        value={formData.end_no}
                                        onChange={handleInputChange}
                                        placeholder="e.g. 100"
                                        className="form-input"
                                        min={parseInt(formData.start_no || 0) + 1}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-footer">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="save-btn"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Booklet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Booklet Modal */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                <FaEdit className="mr-2" />
                                Edit Booklet
                            </h2>
                            <button
                                className="close-modal-btn"
                                onClick={() => setShowEditModal(false)}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="modal-form">
                            <div className="form-group">
                                <label htmlFor="edit_booklet_no">Booklet Number <span className="required">*</span></label>
                                <input
                                    type="text"
                                    id="edit_booklet_no"
                                    name="booklet_no"
                                    value={editData.booklet_no}
                                    onChange={handleEditInputChange}
                                    placeholder="e.g. BK-2023-001"
                                    className="form-input"
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="edit_start_no">Start Number <span className="required">*</span></label>
                                    <input
                                        type="number"
                                        id="edit_start_no"
                                        name="start_no"
                                        value={editData.start_no}
                                        onChange={handleEditInputChange}
                                        placeholder="e.g. 1"
                                        className="form-input"
                                        min="1"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="edit_end_no">End Number <span className="required">*</span></label>
                                    <input
                                        type="number"
                                        id="edit_end_no"
                                        name="end_no"
                                        value={editData.end_no}
                                        onChange={handleEditInputChange}
                                        placeholder="e.g. 100"
                                        className="form-input"
                                        min={parseInt(editData.start_no || 0) + 1}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="bg-warning-100 dark:bg-warning-900/20 text-warning-800 dark:text-warning-300 p-3 rounded-md mb-4">
                                <p className="text-sm">
                                    <strong>Warning:</strong> Changing start or end numbers will regenerate all pages in this booklet.
                                    This may affect existing records that use pages from this booklet.
                                </p>
                            </div>

                            <div className="form-footer">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowEditModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="save-btn"
                                    disabled={loading}
                                >
                                    {loading ? 'Updating...' : 'Update Booklet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmDelete && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                <FaTrash className="mr-2" />
                                Confirm Delete
                            </h2>
                            <button
                                className="close-modal-btn"
                                onClick={() => setConfirmDelete(null)}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p className="text-white mb-4">
                                Are you sure you want to delete this booklet? This action cannot be undone.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="cancel-btn"
                                onClick={() => setConfirmDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-delete close-booklet-btn"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                {loading ? 'Deleting...' : 'Delete Booklet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Booklet Modal */}
            {showViewModal && viewingBooklet && (
                <div className="modal-overlay">
                    <div className="modal-container modal-lg">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                <FaBook className="mr-2" />
                                Booklet Details: {viewingBooklet.booklet_no}
                            </h2>
                            <button
                                className="close-modal-btn"
                                onClick={() => {
                                    setShowViewModal(false);
                                    setViewingBooklet(null);
                                }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="booklet-details-grid">
                                <div className="detail-item">
                                    <span className="detail-label">ID:</span>
                                    <span className="detail-value">{viewingBooklet.id}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Booklet Number:</span>
                                    <span className="detail-value">{viewingBooklet.booklet_no}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Start Number:</span>
                                    <span className="detail-value">{viewingBooklet.start_no}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">End Number:</span>
                                    <span className="detail-value">{viewingBooklet.end_no}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Status:</span>
                                    <span className={`status-badge ${viewingBooklet.is_active ? 'active' : 'inactive'}`}>
                                        {viewingBooklet.is_active ? 'Active' : 'Closed'}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Created:</span>
                                    <span className="detail-value">
                                        {formatDate(viewingBooklet.createdAt)}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Last Updated:</span>
                                    <span className="detail-value">
                                        {formatDate(viewingBooklet.updatedAt)}
                                    </span>
                                </div>
                            </div>

                            <div className="pages-section">
                                <h3 className="section-title">Pages Left</h3>
                                <div className="pages-container">
                                    {viewingBooklet.pages_left.length === 0 ? (
                                        <p className="no-pages">No pages left in this booklet</p>
                                    ) : (
                                        <div className="pages-grid">
                                            {viewingBooklet.pages_left.map((page) => (
                                                <div key={page} className="page-number">
                                                    {page}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="close-btn"
                                onClick={() => {
                                    setShowViewModal(false);
                                    setViewingBooklet(null);
                                }}
                            >
                                Close
                            </button>

                            {viewingBooklet.is_active ? (
                                <>
                                    <button
                                        className="btn-edit"
                                        onClick={() => {
                                            setShowViewModal(false);
                                            handleEdit(viewingBooklet);
                                        }}
                                    >
                                        <FaEdit className="mr-1" />
                                        Edit Booklet
                                    </button>
                                    <button
                                        className="close-booklet-btn"
                                        onClick={() => {
                                            setShowViewModal(false);
                                            handleCloseBooklet(viewingBooklet.id);
                                        }}
                                    >
                                        <FaTimes className="mr-1" />
                                        Close Booklet
                                    </button>
                                </>
                            ) : (
                                <div className="text-red-500 text-sm">
                                    Booklet reactivation has been disabled to prevent duplicate receipt errors.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Add static pageTitle property
BookletsPage.pageTitle = 'Manage Booklets';

export default BookletsPage; 