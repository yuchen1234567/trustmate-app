const Review = require('../models/review');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const Service = require('../models/service');
const Seller = require('../models/seller');

// Show review form
exports.showCreate = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        const orderItems = await OrderItem.getByOrder(orderId);
        
        if (!order || order.user_id !== req.session.user.user_id) {
            return res.status(403).send('Access denied');
        }
        
        // Check if order is completed
        if (order.status !== 'completed') {
            return res.redirect(`/orders/${orderId}`);
        }
        
        res.render('createReview', { order, orderItems, error: null });
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// Create review
exports.create = async (req, res) => {
    try {
        const { order_id, service_id, rating, comment, tags } = req.body;
        const userId = req.session.user.user_id;
        
        // Check if review already exists
        const existingReview = await Review.getByOrder(order_id);
        if (existingReview) {
            return res.redirect(`/orders/${order_id}`);
        }
        
        const tagsString = Array.isArray(tags) ? tags.join(',') : tags || '';
        await Review.create(order_id, userId, service_id, rating, comment, tagsString);
        
        res.redirect(`/orders/${order_id}`);
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// Show edit review form
exports.showEdit = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        
        if (!review) {
            return res.status(404).send('Review not found');
        }
        
        // Only the review author can edit (not even admin)
        if (review.user_id !== req.session.user.user_id) {
            return res.status(403).send('Access denied. You can only edit your own reviews.');
        }
        
        res.render('editReview', { review, error: null });
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// Update review
exports.update = async (req, res) => {
    try {
        const { rating, comment, tags } = req.body;
        const review = await Review.findById(req.params.id);
        
        if (!review) {
            return res.status(404).send('Review not found');
        }
        
        // Only the review author can update (not even admin)
        if (review.user_id !== req.session.user.user_id) {
            return res.status(403).send('Access denied. You can only update your own reviews.');
        }
        
        const tagsString = Array.isArray(tags) ? tags.join(',') : tags || '';
        await Review.update(req.params.id, rating, comment, tagsString);
        
        res.redirect(`/orders/${review.order_id}`);
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// Delete review
exports.delete = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        
        if (!review) {
            return res.status(404).send('Review not found');
        }
        
        // Only the review author OR admin can delete
        const isOwner = review.user_id === req.session.user.user_id;
        const isAdmin = req.session.user.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return res.status(403).send('Access denied. Only the review author or admin can delete reviews.');
        }
        
        await Review.delete(req.params.id);
        res.redirect(`/orders/${review.order_id}`);
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// Seller reply to review
exports.reply = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).send('Review not found');
        }

        if (!req.session.user || req.session.user.role !== 'seller') {
            return res.status(403).send('Access denied. Seller only.');
        }

        const seller = await Seller.findByUserId(req.session.user.user_id);
        if (!seller) {
            return res.status(403).send('Access denied. Seller only.');
        }

        const service = await Service.findById(review.service_id);
        if (!service || service.seller_id !== seller.seller_id) {
            return res.status(403).send('Access denied. You can only reply to reviews on your own services.');
        }

        const reply = (req.body.reply || '').trim();
        if (!reply) {
            return res.redirect(`/services/${review.service_id}`);
        }

        await Review.updateReply(req.params.id, reply);
        res.redirect(`/services/${review.service_id}`);
    } catch (error) {
        console.error(error);
        res.redirect('/services');
    }
};
