const db = require('../db');

class Order {
    static async create(userId, totalAmount) {
        const [result] = await db.query(
            'INSERT INTO orders (user_id, total_amount) VALUES (?, ?)',
            [userId, totalAmount]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await db.query(
            `SELECT o.*, u.username, u.email
             FROM orders o
             JOIN users u ON o.user_id = u.user_id
             WHERE o.order_id = ?`,
            [id]
        );
        return rows[0];
    }

    static async getByUser(userId) {
        const [rows] = await db.query(
            `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );
        return rows;
    }

    static async getAll() {
        const [rows] = await db.query(
            `SELECT o.*, u.username, u.email
             FROM orders o
             JOIN users u ON o.user_id = u.user_id
             ORDER BY o.created_at DESC`
        );
        return rows;
    }

    static async getBySeller(sellerId) {
        const [rows] = await db.query(
            `SELECT o.order_id, o.status, o.total_amount, o.created_at,
                    u.username, u.email,
                    oi.order_item_id, oi.service_id, oi.quantity, oi.price,
                    s.title
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.order_id
             JOIN services s ON oi.service_id = s.service_id
             JOIN users u ON o.user_id = u.user_id
             WHERE s.seller_id = ?
             ORDER BY o.created_at DESC`,
            [sellerId]
        );
        return rows;
    }

    static async isOrderForSeller(orderId, sellerId) {
        const [rows] = await db.query(
            `SELECT 1
             FROM order_items oi
             JOIN services s ON oi.service_id = s.service_id
             WHERE oi.order_id = ? AND s.seller_id = ?
             LIMIT 1`,
            [orderId, sellerId]
        );
        return rows.length > 0;
    }

    static async updateStatus(id, status) {
        await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, id]);
    }

    static async delete(id) {
        await db.query('DELETE FROM orders WHERE order_id = ?', [id]);
    }
}

module.exports = Order;
