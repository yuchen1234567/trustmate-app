const Chat = require('../models/chat');
const Order = require('../models/order');

// Show chat for an order
exports.show = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        const messages = await Chat.getByOrder(orderId);
        
        if (!order) {
            return res.status(404).send('Order not found');
        }
        
        res.render('chat', { order, messages });
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
