const Chat = require('../models/chat');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');

// Show chat for an order
exports.show = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        const messages = await Chat.getByOrder(orderId);
        const orderItems = await OrderItem.getByOrder(orderId);
        
        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Get seller's user_id from order items (via the service's seller)
        let sellerUserId = null;
        if (orderItems && orderItems.length > 0) {
            // Fetch seller's user_id from the first order item
            sellerUserId = orderItems[0].seller_user_id;
        }
        
        res.render('chat', { order, messages, sellerUserId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading chat');
    }
};

// Send message
exports.send = async (req, res) => {
    try {
        const { order_id, receiver_id, message } = req.body;
        const senderId = req.session.user.user_id;
        
        // Validate receiver_id exists
        if (!receiver_id) {
            console.error('Missing receiver_id');
            return res.redirect(`/chat/${order_id}`);
        }
        
        await Chat.create(order_id, senderId, receiver_id, message);
        res.redirect(`/chat/${order_id}`);
    } catch (error) {
        console.error(error);
        res.redirect('/orders');
    }
};

// Show user's chats
exports.index = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const chats = await Chat.getByUser(userId);
        res.render('chats', { chats });
    } catch (error) {
        console.error(error);
        res.render('chats', { chats: [], error: 'Failed to load chats' });
    }
};

// Archive chat (delete)
exports.archive = async (req, res) => {
    try {
        await Chat.delete(req.params.id);
        res.redirect('/chats');
    } catch (error) {
        console.error(error);
        res.redirect('/chats');
    }
};
