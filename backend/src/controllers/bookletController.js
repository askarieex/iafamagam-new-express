const db = require('../models');
const { Op } = require('sequelize');

// Helper function to generate array of numbers in a range
const generateRange = (start, end) => {
    const range = [];
    for (let i = start; i <= end; i++) {
        range.push(i);
    }
    return range;
};

// Create a new booklet
exports.createBooklet = async (req, res) => {
    try {
        const { booklet_no, start_no, end_no } = req.body;

        // Basic validation
        if (!booklet_no || !start_no || !end_no) {
            return res.status(400).json({
                success: false,
                message: 'Booklet number, start number, and end number are required'
            });
        }

        // Validate that end_no is greater than start_no
        if (parseInt(end_no) <= parseInt(start_no)) {
            return res.status(400).json({
                success: false,
                message: 'End number must be greater than start number'
            });
        }

        // Check for overlapping ranges with active booklets
        const overlappingBooklet = await db.Booklet.findOne({
            where: {
                is_active: true,
                [Op.or]: [
                    {
                        start_no: {
                            [Op.between]: [parseInt(start_no), parseInt(end_no)]
                        }
                    },
                    {
                        end_no: {
                            [Op.between]: [parseInt(start_no), parseInt(end_no)]
                        }
                    },
                    {
                        [Op.and]: [
                            { start_no: { [Op.lte]: parseInt(start_no) } },
                            { end_no: { [Op.gte]: parseInt(end_no) } }
                        ]
                    }
                ]
            }
        });

        if (overlappingBooklet) {
            return res.status(400).json({
                success: false,
                message: 'This range overlaps with an existing active booklet'
            });
        }

        // Generate the initial pages_left array
        let pages_left = generateRange(parseInt(start_no), parseInt(end_no));

        // Find any existing transactions with receipt numbers in this range
        // These may be from deleted booklets but we want to exclude them
        const existingReceiptNumbers = await db.Transaction.findAll({
            attributes: ['receipt_no'],
            where: {
                receipt_no: {
                    [Op.between]: [parseInt(start_no), parseInt(end_no)]
                }
            }
        });

        // If we found existing transactions with receipt numbers in our range
        if (existingReceiptNumbers.length > 0) {
            // Extract the receipt numbers to exclude
            const usedReceiptNumbers = existingReceiptNumbers.map(t => t.receipt_no);

            // Filter them out from our pages_left array
            pages_left = pages_left.filter(num => !usedReceiptNumbers.includes(num));

            console.log(`Excluded ${usedReceiptNumbers.length} receipt numbers that are already used in transactions: ${usedReceiptNumbers.join(', ')}`);

            // If no pages are left after excluding used receipt numbers, return an error
            if (pages_left.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'All receipt numbers in this range are already used in existing transactions'
                });
            }
        }

        // Create the booklet
        const newBooklet = await db.Booklet.create({
            booklet_no,
            start_no: parseInt(start_no),
            end_no: parseInt(end_no),
            pages_left,
            is_active: true
        });

        return res.status(201).json({
            success: true,
            data: newBooklet,
            excludedReceiptNumbers: existingReceiptNumbers.length > 0
                ? existingReceiptNumbers.map(t => t.receipt_no)
                : []
        });
    } catch (error) {
        console.error('Error creating booklet:', error);

        // Check for unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'A booklet with this number already exists'
            });
        }

        // Check for validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => e.message)
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Error creating booklet',
            error: error.message
        });
    }
};

// Get all booklets with optional filtering for active booklets
exports.getAllBooklets = async (req, res) => {
    try {
        const { active } = req.query;

        const whereClause = {};

        // If active=true is specified in query, only return active booklets
        if (active === 'true') {
            whereClause.is_active = true;
        }

        const booklets = await db.Booklet.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            count: booklets.length,
            data: booklets
        });
    } catch (error) {
        console.error('Error retrieving booklets:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving booklets',
            error: error.message
        });
    }
};

// Get single booklet by ID
exports.getBookletById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid booklet ID is required'
            });
        }

        const booklet = await db.Booklet.findByPk(id);

        if (!booklet) {
            return res.status(404).json({
                success: false,
                message: 'Booklet not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: booklet
        });
    } catch (error) {
        console.error('Error retrieving booklet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving booklet',
            error: error.message
        });
    }
};

// Close a booklet (set is_active to false)
exports.closeBooklet = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid booklet ID is required'
            });
        }

        // Find booklet by ID
        const booklet = await db.Booklet.findByPk(id);

        if (!booklet) {
            return res.status(404).json({
                success: false,
                message: 'Booklet not found'
            });
        }

        // Check if booklet is already closed
        if (!booklet.is_active) {
            return res.status(400).json({
                success: false,
                message: 'Booklet is already closed'
            });
        }

        // Close the booklet
        const updatedBooklet = await booklet.update({
            is_active: false
        });

        return res.status(200).json({
            success: true,
            message: 'Booklet closed successfully',
            data: updatedBooklet
        });
    } catch (error) {
        console.error('Error closing booklet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error closing booklet',
            error: error.message
        });
    }
};

// Update booklet
exports.updateBooklet = async (req, res) => {
    try {
        const { id } = req.params;
        const { booklet_no, start_no, end_no } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid booklet ID is required'
            });
        }

        // Find booklet by ID
        const booklet = await db.Booklet.findByPk(id);

        if (!booklet) {
            return res.status(404).json({
                success: false,
                message: 'Booklet not found'
            });
        }

        // Data to update
        const updateData = {};

        // Check if booklet_no is being changed
        if (booklet_no && booklet_no !== booklet.booklet_no) {
            // Check if new booklet_no is already in use
            const existingBooklet = await db.Booklet.findOne({
                where: {
                    booklet_no,
                    id: { [Op.ne]: id } // Exclude current booklet
                }
            });

            if (existingBooklet) {
                return res.status(400).json({
                    success: false,
                    message: 'A booklet with this number already exists'
                });
            }

            updateData.booklet_no = booklet_no;
        }

        // Check if start_no or end_no is being changed
        const startNoChanged = start_no && parseInt(start_no) !== booklet.start_no;
        const endNoChanged = end_no && parseInt(end_no) !== booklet.end_no;

        // If changing start_no and/or end_no, validate the range
        if (startNoChanged || endNoChanged) {
            const newStartNo = startNoChanged ? parseInt(start_no) : booklet.start_no;
            const newEndNo = endNoChanged ? parseInt(end_no) : booklet.end_no;

            // Validate that end_no is greater than start_no
            if (newEndNo <= newStartNo) {
                return res.status(400).json({
                    success: false,
                    message: 'End number must be greater than start number'
                });
            }

            // Check for overlapping ranges with other active booklets
            const overlappingBooklet = await db.Booklet.findOne({
                where: {
                    id: { [Op.ne]: id }, // Exclude current booklet
                    is_active: true,
                    [Op.or]: [
                        {
                            start_no: {
                                [Op.between]: [newStartNo, newEndNo]
                            }
                        },
                        {
                            end_no: {
                                [Op.between]: [newStartNo, newEndNo]
                            }
                        },
                        {
                            [Op.and]: [
                                { start_no: { [Op.lte]: newStartNo } },
                                { end_no: { [Op.gte]: newEndNo } }
                            ]
                        }
                    ]
                }
            });

            if (overlappingBooklet) {
                return res.status(400).json({
                    success: false,
                    message: 'This range overlaps with an existing active booklet'
                });
            }
        }

        // If changing start_no or end_no, regenerate pages_left
        if (startNoChanged || endNoChanged) {
            const newStartNo = startNoChanged ? parseInt(start_no) : booklet.start_no;
            const newEndNo = endNoChanged ? parseInt(end_no) : booklet.end_no;

            updateData.start_no = newStartNo;
            updateData.end_no = newEndNo;

            // Generate new pages_left array
            let newPagesLeft = generateRange(newStartNo, newEndNo);

            // Find any existing transactions with receipt numbers in this range
            // These may be from deleted booklets but we want to exclude them
            const existingReceiptNumbers = await db.Transaction.findAll({
                attributes: ['receipt_no'],
                where: {
                    receipt_no: {
                        [Op.between]: [newStartNo, newEndNo]
                    },
                    [Op.or]: [
                        { booklet_id: { [Op.ne]: id } }, // Different booklet
                        { booklet_id: null } // No booklet (from deleted booklets)
                    ]
                }
            });

            // If we found existing transactions with receipt numbers in our range
            if (existingReceiptNumbers.length > 0) {
                // Extract the receipt numbers to exclude
                const usedReceiptNumbers = existingReceiptNumbers.map(t => t.receipt_no);

                // Filter them out from our pages_left array
                newPagesLeft = newPagesLeft.filter(num => !usedReceiptNumbers.includes(num));

                console.log(`Excluded ${usedReceiptNumbers.length} receipt numbers that are already used in transactions: ${usedReceiptNumbers.join(', ')}`);

                // If no pages are left after excluding used receipt numbers, return an error
                if (newPagesLeft.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'All receipt numbers in this range are already used in existing transactions'
                    });
                }
            }

            // Also keep any used receipt numbers from the current range that still fit within the new range
            const transactionsFromCurrentBooklet = await db.Transaction.findAll({
                attributes: ['receipt_no'],
                where: {
                    booklet_id: id,
                    receipt_no: {
                        [Op.between]: [newStartNo, newEndNo]
                    }
                }
            });

            // Remove receipt numbers used in transactions from this booklet from pages_left
            if (transactionsFromCurrentBooklet.length > 0) {
                const usedReceiptNumbers = transactionsFromCurrentBooklet.map(t => t.receipt_no);
                newPagesLeft = newPagesLeft.filter(num => !usedReceiptNumbers.includes(num));
                console.log(`Removing ${usedReceiptNumbers.length} receipt numbers already used by transactions from this booklet`);
            }

            updateData.pages_left = newPagesLeft;
        }

        // Update the booklet
        const updatedBooklet = await booklet.update(updateData);

        return res.status(200).json({
            success: true,
            message: 'Booklet updated successfully',
            data: updatedBooklet
        });
    } catch (error) {
        console.error('Error updating booklet:', error);

        // Check for unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'A booklet with this number already exists'
            });
        }

        // Check for validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => e.message)
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Error updating booklet',
            error: error.message
        });
    }
};

// Delete booklet
exports.deleteBooklet = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid booklet ID is required'
            });
        }

        // Find booklet by ID
        const booklet = await db.Booklet.findByPk(id);

        if (!booklet) {
            return res.status(404).json({
                success: false,
                message: 'Booklet not found'
            });
        }

        // Check for existing transactions tied to this booklet
        const transactionsCount = await db.Transaction.count({
            where: { booklet_id: id }
        });

        if (transactionsCount > 0) {
            // Instead of deleting transactions, update them to remove the booklet reference
            // but keep the receipt_no intact
            await db.Transaction.update(
                { booklet_id: null },
                { where: { booklet_id: id } }
            );

            console.log(`Preserved ${transactionsCount} transactions while deleting booklet ${id}`);
        }

        // Delete the booklet
        await booklet.destroy();

        return res.status(200).json({
            success: true,
            message: 'Booklet deleted successfully',
            transactionsPreserved: transactionsCount > 0 ? transactionsCount : 0
        });
    } catch (error) {
        console.error('Error deleting booklet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting booklet',
            error: error.message
        });
    }
};

// Reactivate a closed booklet
exports.reactivateBooklet = async (req, res) => {
    try {
        return res.status(400).json({
            success: false,
            message: 'Booklet reactivation has been disabled to prevent duplicate receipt number errors'
        });
    } catch (error) {
        console.error('Error reactivating booklet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error reactivating booklet',
            error: error.message
        });
    }
}; 