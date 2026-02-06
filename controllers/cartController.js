const Cart = require('../models/cart');
const Service = require('../models/service');
const SellerAvailability = require('../models/sellerAvailability');
const OrderItem = require('../models/orderItem');

// Show cart
exports.index = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const cartItems = await Cart.getByUser(userId);
        let total = await Cart.getTotal(userId);

        total = Number(total) || 0;

        res.render('cart', { cartItems, total });
    } catch (error) {
        console.error(error);
        res.render('cart', { cartItems: [], total: 0, error: 'Failed to load cart' });
    }
};

// Add to cart
exports.add = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const { service_id, quantity, booking_date } = req.body;

        if (!booking_date) {
            req.session.errorMessage = 'Please select a booking date before adding to cart.';
            return res.redirect(`/services/${service_id}`);
        }

        const service = await Service.findById(service_id);
        if (!service) {
            req.session.errorMessage = 'Service not found.';
            return res.redirect('/services');
        }

        const isAvailable = await SellerAvailability.isAvailable(service.seller_id, booking_date);
        if (!isAvailable) {
            req.session.errorMessage = 'Selected date is unavailable. Please choose another date.';
            return res.redirect(`/services/${service_id}`);
        }

        const hasConflict = await OrderItem.hasPaidBooking(service_id, booking_date);
        if (hasConflict) {
            req.session.errorMessage = 'Selected date is already booked. Please choose another date.';
            return res.redirect(`/services/${service_id}`);
        }

        await Cart.add(userId, service_id, booking_date, quantity || 1);
        
        // Set success message
        req.session.successMessage = 'Service added to cart successfully!';
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Failed to add service to cart. Please try again.';
        const serviceId = req.body?.service_id;
        if (serviceId) {
            return res.redirect(`/services/${serviceId}`);
        }
        res.redirect('/services');
    }
};

// Update cart item quantity
exports.update = async (req, res) => {
    try {
        const { cart_id, quantity } = req.body;
        
        if (quantity <= 0) {
            await Cart.remove(cart_id);
        } else {
            await Cart.updateQuantity(cart_id, quantity);
        }
        
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.redirect('/cart');
    }
};

// Remove from cart
exports.remove = async (req, res) => {
    try {
        await Cart.remove(req.params.id);
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.redirect('/cart');
    }
};

// Clear cart
exports.clear = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        await Cart.clearUserCart(userId);
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.redirect('/cart');
    }
};
