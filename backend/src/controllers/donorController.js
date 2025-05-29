const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get all donors with optional filtering
 * @route GET /api/donors
 */
exports.getAllDonors = async (req, res) => {
    try {
        const { search } = req.query;

        // Build query condition based on parameters
        const whereCondition = {};

        // Add search functionality
        if (search) {
            whereCondition[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } },
                { address: { [Op.like]: `%${search}%` } },
                { note: { [Op.like]: `%${search}%` } }
            ];
        }

        const donors = await db.Donor.findAll({
            where: whereCondition,
            order: [['name', 'ASC']]
        });

        return res.status(200).json({
            success: true,
            count: donors.length,
            data: donors
        });
    } catch (error) {
        console.error('Error fetching donors:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve donors',
            error: error.message
        });
    }
};

/**
 * Get donor by ID
 * @route GET /api/donors/:id
 */
exports.getDonorById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid donor ID is required'
            });
        }

        const donor = await db.Donor.findByPk(id);

        if (!donor) {
            return res.status(404).json({
                success: false,
                message: `Donor with ID ${id} not found`
            });
        }

        return res.status(200).json({
            success: true,
            data: donor
        });
    } catch (error) {
        console.error('Error fetching donor:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve donor',
            error: error.message
        });
    }
};

/**
 * Create a new donor
 * @route POST /api/donors
 */
exports.createDonor = async (req, res) => {
    try {
        const { name, phone, email, address, note } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Donor name is required'
            });
        }

        // Create the donor
        const newDonor = await db.Donor.create({
            name,
            phone,
            email,
            address,
            note
        });

        return res.status(201).json({
            success: true,
            message: 'Donor created successfully',
            data: newDonor
        });
    } catch (error) {
        console.error('Error creating donor:', error);

        // Handle validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(err => ({
                    field: err.path,
                    message: err.message
                }))
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to create donor',
            error: error.message
        });
    }
};

/**
 * Update a donor
 * @route PATCH /api/donors/:id
 */
exports.updateDonor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, note } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid donor ID is required'
            });
        }

        // Find the donor
        const donor = await db.Donor.findByPk(id);

        if (!donor) {
            return res.status(404).json({
                success: false,
                message: `Donor with ID ${id} not found`
            });
        }

        // Validate that name is not being set to empty if it's provided
        if (name === '') {
            return res.status(400).json({
                success: false,
                message: 'Donor name cannot be empty'
            });
        }

        // Update the donor
        await donor.update({
            name: name !== undefined ? name : donor.name,
            phone: phone !== undefined ? phone : donor.phone,
            email: email !== undefined ? email : donor.email,
            address: address !== undefined ? address : donor.address,
            note: note !== undefined ? note : donor.note
        });

        // Fetch the updated donor
        const updatedDonor = await db.Donor.findByPk(id);

        return res.status(200).json({
            success: true,
            message: 'Donor updated successfully',
            data: updatedDonor
        });
    } catch (error) {
        console.error('Error updating donor:', error);

        // Handle validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(err => ({
                    field: err.path,
                    message: err.message
                }))
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update donor',
            error: error.message
        });
    }
};

/**
 * Delete a donor
 * @route DELETE /api/donors/:id
 */
exports.deleteDonor = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid donor ID is required'
            });
        }

        // Find the donor
        const donor = await db.Donor.findByPk(id);

        if (!donor) {
            return res.status(404).json({
                success: false,
                message: `Donor with ID ${id} not found`
            });
        }

        // Delete the donor
        await donor.destroy();

        return res.status(200).json({
            success: true,
            message: 'Donor deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting donor:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete donor',
            error: error.message
        });
    }
}; 