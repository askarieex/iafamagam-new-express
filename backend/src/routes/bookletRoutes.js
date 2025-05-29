const express = require('express');
const router = express.Router();
const bookletController = require('../controllers/bookletController');

// Create a new booklet
router.post('/', bookletController.createBooklet);

// Get all booklets, with optional active=true filter
router.get('/', bookletController.getAllBooklets);

// Get a single booklet by ID
router.get('/:id', bookletController.getBookletById);

// Update booklet
router.put('/:id', bookletController.updateBooklet);

// Delete booklet
router.delete('/:id', bookletController.deleteBooklet);

// Close a booklet (set is_active to false)
router.patch('/:id/close', bookletController.closeBooklet);

// Reactivate a booklet (set is_active to true)
router.patch('/:id/reactivate', bookletController.reactivateBooklet);

module.exports = router; 