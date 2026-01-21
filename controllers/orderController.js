const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const Cart = require('../models/cart');

// Show checkout page
exports.showCheckout = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const cartItems = await Cart.getByUser(userId);
        let total = await Cart.getTotal(userId);
        
        // Ensure total is a number
        total = total || 0;
        
        if (cartItems.length === 0) {
            return res.redirect('/cart');
        }
        
        res.render('checkout', { cartItems, total });
    } catch (error) {
        console.error(error);
        res.redirect('/cart');
    }
};

// Create order from cart
exports.create = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const cartItems = await Cart.getByUser(userId);
        
        if (cartItems.length === 0) {
            return res.redirect('/cart');
        }
        
        const total = await Cart.getTotal(userId);
        const orderId = await Order.create(userId, total);
        
        // Create order items
        for (const item of cartItems) {
            await OrderItem.create(orderId, item.service_id, item.quantity, item.price);
        }
        
        // Clear cart
        await Cart.clearUserCart(userId);
        
        res.redirect(`/orders/${orderId}`);
    } catch (error) {
        console.error(error);
        res.redirect('/cart');
    }
};

// Show user's orders
exports.index = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const orders = await Order.getByUser(userId);
        res.render('orders', { orders });
    } catch (error) {
        console.error(error);
        res.render('orders', { orders: [], error: 'Failed to load orders' });
    }
};

// Show order details
exports.show = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        const orderItems = await OrderItem.getByOrder(req.params.id);
        
        if (!order) {
            return res.status(404).send('Order not found');
        }
        
        res.render('orderDetail', { order, orderItems });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading order');
    }
};

// Update order status
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        await Order.updateStatus(req.params.id, status);
        res.redirect(`/orders/${req.params.id}`);
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// Cancel order
exports.cancel = async (req, res) => {
    try {
        await Order.updateStatus(req.params.id, 'cancelled');
        res.redirect('/orders');
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// ===== ADMIN FUNCTIONS =====

// Show all orders (admin only)
exports.adminIndex = async (req, res) => {
    try {
        const { status, search } = req.query;
        let orders;

        if (status) {
            // Filter by status
            orders = await Order.getAll();
            orders = orders.filter(order => order.status === status);
        } else if (search) {
            // Search by username or email
            orders = await Order.getAll();
            orders = orders.filter(order => 
                order.username.toLowerCase().includes(search.toLowerCase()) ||
                order.email.toLowerCase().includes(search.toLowerCase())
            );
        } else {
            orders = await Order.getAll();
        }

        res.render('adminOrders', { 
            orders, 
            selectedStatus: status || '', 
            searchTerm: search || '' 
        });
    } catch (error) {
        console.error(error);
        res.render('adminOrders', { 
            orders: [], 
            selectedStatus: '', 
            searchTerm: '',
            error: 'Failed to load orders' 
        });
    }
};

// Show order details (admin can view any order)
exports.adminShow = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        const items = await OrderItem.getByOrder(req.params.id);

        if (!order) {
            return res.status(404).send('Order not found');
        }

        res.render('orderDetail', { order, items });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading order');
    }
};

// Update order status (admin only)
exports.adminUpdateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        await Order.updateStatus(req.params.id, status);
        
        req.session.successMessage = 'Order status updated successfully';
        res.redirect(`/admin/orders/${req.params.id}`);
    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Failed to update order status';
        res.redirect(`/admin/orders/${req.params.id}`);
    }
};
