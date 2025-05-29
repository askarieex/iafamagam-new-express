import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaPlus, FaEdit, FaTrash, FaSync, FaSearch,
    FaUserAlt, FaPhone, FaEnvelope, FaMapMarkerAlt,
    FaStickyNote, FaArrowLeft, FaCheck, FaTimes
} from 'react-icons/fa';
import API_CONFIG from '../config';

export default function DonorsPage() {
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Form state for adding/editing donors
    const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
    const [currentDonor, setCurrentDonor] = useState(null);
    const [showForm, setShowForm] = useState(false);

    // Form data for donors
    const [donorFormData, setDonorFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        note: ''
    });

    // Configure axios with default options
    const api = axios.create({
        baseURL: API_CONFIG.BASE_URL.replace('/api', ''),
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Fetch all donors
    const fetchDonors = async (search = '') => {
        try {
            setLoading(true);
            setError(null);

            const url = search ? `/api/donors?search=${encodeURIComponent(search)}` : '/api/donors';
            const response = await api.get(url);

            if (response.data && response.data.data) {
                setDonors(response.data.data);
            } else {
                setDonors([]);
                console.warn('Unexpected API response format:', response.data);
            }
        } catch (err) {
            console.error('Error fetching donors:', err);

            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.response) {
                setError(`Failed to fetch donors. Server responded with: ${err.response.status} ${err.response.statusText}`);
            } else {
                setError(`Failed to fetch donors: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Retry connection
    const retryConnection = () => {
        fetchDonors(searchQuery);
    };

    // Load data on component mount and when search changes
    useEffect(() => {
        fetchDonors(searchQuery);
    }, [searchQuery]);

    // Handle form input changes for donors
    const handleDonorInputChange = (e) => {
        const { name, value } = e.target;
        setDonorFormData({
            ...donorFormData,
            [name]: value
        });
    };

    // Reset donor form to initial state
    const resetDonorForm = () => {
        setDonorFormData({
            name: '',
            phone: '',
            email: '',
            address: '',
            note: ''
        });
        setCurrentDonor(null);
        setFormMode('add');
    };

    // Open form for adding a new donor
    const handleAddNew = () => {
        resetDonorForm();
        setFormMode('add');
        setShowForm(true);
    };

    // Open form for editing an existing donor
    const handleEditDonor = (donor) => {
        setDonorFormData({
            name: donor.name,
            phone: donor.phone || '',
            email: donor.email || '',
            address: donor.address || '',
            note: donor.note || ''
        });
        setCurrentDonor(donor);
        setFormMode('edit');
        setShowForm(true);
    };

    // Handle form submission for donors
    const handleDonorSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null);

            if (formMode === 'add') {
                // Add new donor
                await api.post('/api/donors', donorFormData);
            } else {
                // Update existing donor
                await api.patch(`/api/donors/${currentDonor.id}`, donorFormData);
            }

            // Refresh donor list
            fetchDonors(searchQuery);
            setShowForm(false);
            resetDonorForm();
        } catch (err) {
            console.error(`Error ${formMode === 'add' ? 'adding' : 'updating'} donor:`, err);
            setError(err.response?.data?.message || `Failed to ${formMode} donor: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle donor deletion
    const handleDeleteDonor = async (id) => {
        if (!window.confirm('Are you sure you want to delete this donor?')) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await api.delete(`/api/donors/${id}`);

            // Refresh donor list
            fetchDonors(searchQuery);
        } catch (err) {
            console.error('Error deleting donor:', err);
            setError(err.response?.data?.message || `Failed to delete donor: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle search
    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset to first page on new search
    };

    // Handle pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentDonors = donors.slice(indexOfFirstItem, indexOfLastItem);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    // Render donor form
    const renderDonorForm = () => (
        <div className="p-8 animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => setShowForm(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded-md hover:bg-secondary hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    <FaArrowLeft className="text-xs" />
                    <span>Back</span>
                </button>
                <h2 className="text-xl font-medium text-white">{formMode === 'add' ? 'Add New Donor' : 'Edit Donor'}</h2>
            </div>

            <form onSubmit={handleDonorSubmit} className="bg-secondary rounded-md p-6 drop-shadow-md backdrop-blur-sm flex flex-col gap-5 max-w-3xl border border-gray-700/30">
                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                        <FaUserAlt className="text-primary" />
                        Donor Name <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={donorFormData.name}
                        onChange={handleDonorInputChange}
                        required
                        placeholder="Enter donor's full name"
                        className="px-3 py-2.5 bg-background border border-gray-700 rounded-md text-white text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                            <FaPhone className="text-primary" />
                            Phone Number
                        </label>
                        <input
                            type="text"
                            name="phone"
                            value={donorFormData.phone}
                            onChange={handleDonorInputChange}
                            placeholder="Enter phone number"
                            className="px-3 py-2.5 bg-background border border-gray-700 rounded-md text-white text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                            <FaEnvelope className="text-primary" />
                            Email Address
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={donorFormData.email}
                            onChange={handleDonorInputChange}
                            placeholder="Enter email address"
                            className="px-3 py-2.5 bg-background border border-gray-700 rounded-md text-white text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                        <FaMapMarkerAlt className="text-primary" />
                        Address
                    </label>
                    <textarea
                        name="address"
                        value={donorFormData.address}
                        onChange={handleDonorInputChange}
                        placeholder="Enter full address"
                        rows="3"
                        className="px-3 py-2.5 bg-background border border-gray-700 rounded-md text-white text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200 resize-none"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                        <FaStickyNote className="text-primary" />
                        Notes
                    </label>
                    <textarea
                        name="note"
                        value={donorFormData.note}
                        onChange={handleDonorInputChange}
                        placeholder="Additional notes about the donor"
                        rows="3"
                        className="px-3 py-2.5 bg-background border border-gray-700 rounded-md text-white text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200 resize-none"
                    />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                    <button
                        type="button"
                        className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-md hover:bg-secondary hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-600"
                        onClick={() => setShowForm(false)}
                    >
                        <span className="flex items-center gap-1.5">
                            <FaTimes className="text-xs" />
                            Cancel
                        </span>
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-light transition-all duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <FaCheck className="text-xs" />
                                <span>{formMode === 'add' ? 'Create Donor' : 'Update Donor'}</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    // Render donor list or empty state
    const renderDonorContent = () => {
        if (loading && donors.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <div className="w-10 h-10 border-4 border-t-primary border-gray-700/30 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-400">Loading donors...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <p className="text-danger mb-6">{error}</p>
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-md hover:bg-gray-700/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-600"
                        onClick={retryConnection}
                    >
                        <FaSync className="animate-spin-slow" /> Retry Connection
                    </button>
                </div>
            );
        }

        if (donors.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                        <FaUserAlt className="text-2xl text-primary/70" />
                    </div>
                    <p className="text-gray-400 mb-6 max-w-md">No donors found. Add your first donor to start managing your donations!</p>
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        onClick={handleAddNew}
                    >
                        <FaPlus /> Add Donor
                    </button>
                </div>
            );
        }

        return (
            <div className="bg-secondary rounded-md overflow-hidden border border-gray-700/30 shadow-md animate-fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-800/50">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 border-b border-gray-700">Name</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 border-b border-gray-700">Phone</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 border-b border-gray-700">Email</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 border-b border-gray-700">Address</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 border-b border-gray-700">Notes</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 border-b border-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentDonors.map((donor) => (
                                <tr key={donor.id} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-800/30 transition-colors duration-150">
                                    <td className="py-3 px-4 text-sm font-medium text-white">{donor.name}</td>
                                    <td className="py-3 px-4 text-sm">{donor.phone || '-'}</td>
                                    <td className="py-3 px-4 text-sm">{donor.email || '-'}</td>
                                    <td className="py-3 px-4 text-sm">{donor.address ? (donor.address.length > 30 ? donor.address.substring(0, 30) + '...' : donor.address) : '-'}</td>
                                    <td className="py-3 px-4 text-sm">{donor.note ? (donor.note.length > 30 ? donor.note.substring(0, 30) + '...' : donor.note) : '-'}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex gap-2">
                                            <button
                                                className="p-1.5 bg-primary/10 rounded-md text-primary hover:bg-primary/20 transition-colors"
                                                onClick={() => handleEditDonor(donor)}
                                                title="Edit Donor"
                                            >
                                                <FaEdit size={14} />
                                            </button>
                                            <button
                                                className="p-1.5 bg-danger/10 rounded-md text-danger hover:bg-danger/20 transition-colors"
                                                onClick={() => handleDeleteDonor(donor.id)}
                                                title="Delete Donor"
                                            >
                                                <FaTrash size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {donors.length > itemsPerPage && (
                    <div className="flex justify-center py-4 border-t border-gray-700 gap-1">
                        {Array.from({ length: Math.ceil(donors.length / itemsPerPage) }).map((_, index) => (
                            <button
                                key={index}
                                className={`px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${currentPage === index + 1
                                        ? 'bg-primary text-white font-medium shadow-md'
                                        : 'text-gray-400 border border-gray-700 hover:bg-gray-700/50'
                                    }`}
                                onClick={() => paginate(index + 1)}
                            >
                                {index + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full bg-background text-white">
            {!showForm ? (
                <>
                    <div className="flex justify-between items-center p-4 bg-secondary border-b border-gray-700 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <FaUserAlt className="text-primary text-sm" />
                            </div>
                            <h1 className="text-xl font-medium">Donor Management</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                                <input
                                    type="text"
                                    placeholder="Search donors..."
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    className="pl-8 pr-3 py-2 bg-background border border-gray-700 rounded-md text-white text-sm w-64 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                                />
                            </div>
                            <button
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-primary/50 transform hover:-translate-y-0.5"
                                onClick={handleAddNew}
                            >
                                <FaPlus /> Add Donor
                            </button>
                        </div>
                    </div>

                    <div className="p-8">
                        {renderDonorContent()}
                    </div>
                </>
            ) : (
                renderDonorForm()
            )}
        </div>
    );
} 