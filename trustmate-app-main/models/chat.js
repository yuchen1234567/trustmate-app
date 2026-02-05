const db = require('../db');

class Chat {
    static async create(orderId, senderId, receiverId, message) {
        const [result] = await db.query(
            'INSERT INTO chats (order_id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)',
            [orderId, senderId, receiverId, message]
        );
        return result.insertId;
    }

    static async getByOrder(orderId) {
        const [rows] = await db.query(
            `SELECT c.*, 
                    sender.username as sender_name,
                    receiver.username as receiver_name
             FROM chats c
             JOIN users sender ON c.sender_id = sender.user_id
             JOIN users receiver ON c.receiver_id = receiver.user_id
             WHERE c.order_id = ?
             ORDER BY c.sent_at ASC`,
            [orderId]
        );
        return rows;
    }

    static async getByUser(userId) {
        const [rows] = await db.query(
            `SELECT DISTINCT c.order_id, o.*, u.username as other_user
             FROM chats c
             JOIN orders o ON c.order_id = o.order_id
             JOIN users u ON (CASE WHEN c.sender_id = ? THEN c.receiver_id ELSE c.sender_id END) = u.user_id
             WHERE c.sender_id = ? OR c.receiver_id = ?
             ORDER BY c.sent_at DESC`,
            [userId, userId, userId]
        );
        return rows;
    }

    static async delete(id) {
        await db.query('DELETE FROM chats WHERE chat_id = ?', [id]);
    }
}

module.exports = Chat;
