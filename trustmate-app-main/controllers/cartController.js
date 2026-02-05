const Cart = require('../models/cart');

// Show cart
exports.index = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const cartItems = await Cart.getByUser(userId);
        let total = await Cart.getTotal(userId);
        
        // Ensure total is a number
        total = total || 0;
        
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
        const { service_id, quantity } = req.body;
        
        await Cart.add(userId, service_id, quantity || 1);
        
        // Set success message
        req.session.successMessage = 'Service added to cart successfully!';
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Failed to add service to cart';
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
