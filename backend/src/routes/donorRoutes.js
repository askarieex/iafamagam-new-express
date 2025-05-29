const express = require('express');
const donorController = require('../controllers/donorController');
const router = express.Router();

// Get all donors with optional filtering
router.get('/', donorController.getAllDonors);

// Get a specific donor by ID
router.get('/:id', donorController.getDonorById);

// Create a new donor
router.post('/', donorController.createDonor);

// Update an existing donor
router.patch('/:id', donorController.updateDonor);

// Delete a donor
router.delete('/:id', donorController.deleteDonor);

module.exports = router; 