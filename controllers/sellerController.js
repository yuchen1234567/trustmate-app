const Seller = require('../models/seller');
const Service = require('../models/service');
const User = require('../models/user');

// Show become seller form
exports.showRegister = (req, res) => {
    res.render('becomeSeller', { error: null });
};

// Register as seller
exports.register = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const { business_name, description } = req.body;
        
        // Check if already a seller
        const existingSeller = await Seller.findByUserId(userId);
        if (existingSeller) {
            return res.render('becomeSeller', { error: 'You are already a seller' });
        }
        
        const sellerId = await Seller.create(userId, business_name, description);
        
        // Update user role to seller
        await User.updateStatus(userId, 'active');
        req.session.user.role = 'seller';
        req.session.sellerId = sellerId;
        
        // Update role in database
        const db = require('../db');
        await db.query('UPDATE users SET role = ? WHERE user_id = ?', ['seller', userId]);
        
        res.redirect('/seller/dashboard');
    } catch (error) {
        console.error(error);
        res.render('becomeSeller', { error: 'Failed to register as seller' });
    }
};

// Show seller dashboard
exports.dashboard = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const seller = await Seller.findByUserId(userId);
        
        if (!seller) {
            return res.redirect('/seller/register');
        }
        
        req.session.sellerId = seller.seller_id;
        const services = await Service.getBySeller(seller.seller_id);
        
        res.render('sellerDashboard', { seller, services });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

// Show seller's services
exports.services = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const seller = await Seller.findByUserId(userId);
        
        if (!seller) {
            return res.redirect('/seller/register');
        }
        
        const services = await Service.getBySeller(seller.seller_id);
        res.render('sellerServices', { services });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};
