const OrderItem = require('../models/orderItem');

// Get order items by order
exports.getByOrder = async (req, res) => {
    try {
        const orderItems = await OrderItem.getByOrder(req.params.orderId);
        res.json(orderItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to load order items' });
    }
};

// This controller is mainly used internally by orderController
// Most operations are handled through the Order controller
