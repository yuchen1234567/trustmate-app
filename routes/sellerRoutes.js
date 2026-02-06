const express = require('express');
const router = express.Router();

const sellerController = require('../controllers/sellerController');
const { isAuthenticated, isSeller } = require('../middleware');

router.post('/availability', isAuthenticated, isSeller, sellerController.updateAvailability);

module.exports = router;
