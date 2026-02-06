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
            `SELECT o.*, u.username, u.email,
                    COALESCE(p.status, 'unpaid') AS payment_status,
                    COALESCE(p.escrow_status, 'none') AS escrow_status,
                    p.provider AS payment_provider,
                    p.payment_reference
             FROM orders o
             JOIN users u ON o.user_id = u.user_id
             LEFT JOIN payments p ON p.order_id = o.order_id
             WHERE o.order_id = ?`,
            [id]
        );
        return rows[0];
    }

    static async getByUser(userId) {
        const [rows] = await db.query(
            `SELECT o.*,
                    COALESCE(p.status, 'unpaid') AS payment_status,
                    COALESCE(p.escrow_status, 'none') AS escrow_status,
                    p.provider AS payment_provider,
                    p.payment_reference
             FROM orders o
             LEFT JOIN payments p ON p.order_id = o.order_id
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC`,
            [userId]
        );
        return rows;
    }

    static async findLatestPendingPaymentByUser(userId) {
        const [rows] = await db.query(
            `SELECT o.*,
                    COALESCE(p.status, 'unpaid') AS payment_status,
                    COALESCE(p.escrow_status, 'none') AS escrow_status,
                    p.provider AS payment_provider,
                    p.payment_reference
             FROM orders o
             LEFT JOIN payments p ON p.order_id = o.order_id
             WHERE o.user_id = ?
               AND o.status = 'pending_payment'
               AND COALESCE(p.status, 'unpaid') <> 'paid'
             ORDER BY o.created_at DESC
             LIMIT 1`,
            [userId]
        );
        return rows[0] || null;
    }

    static async countHighValueByUserWithin(userId, minAmount, minutes) {
        const [rows] = await db.query(
            `SELECT COUNT(*) AS count
             FROM orders
             WHERE user_id = ?
               AND total_amount >= ?
               AND created_at >= (NOW() - INTERVAL ? MINUTE)`,
            [userId, minAmount, minutes]
        );
        return Number(rows[0]?.count || 0);
    }

    static async getHighValueByUserWithin(userId, minAmount, minutes, endTime) {
        const [rows] = await db.query(
            `SELECT o.*,
                    COALESCE(p.status, 'unpaid') AS payment_status,
                    COALESCE(p.escrow_status, 'none') AS escrow_status,
                    p.provider AS payment_provider,
                    p.payment_reference
             FROM orders o
             LEFT JOIN payments p ON p.order_id = o.order_id
             WHERE o.user_id = ?
               AND o.total_amount >= ?
               AND o.created_at >= DATE_SUB(?, INTERVAL ? MINUTE)
               AND o.created_at <= ?
             ORDER BY o.created_at DESC`,
            [userId, minAmount, endTime, minutes, endTime]
        );
        return rows;
    }

    static async getAll() {
        const [rows] = await db.query(
            `SELECT o.*, u.username, u.email,
                    COALESCE(p.status, 'unpaid') AS payment_status,
                    COALESCE(p.escrow_status, 'none') AS escrow_status,
                    p.provider AS payment_provider,
                    p.payment_reference
             FROM orders o
             JOIN users u ON o.user_id = u.user_id
             LEFT JOIN payments p ON p.order_id = o.order_id
             ORDER BY o.created_at DESC`
        );
        return rows;
    }

    static async getBySeller(sellerId) {
        const [rows] = await db.query(
            `SELECT o.order_id, o.status, o.total_amount, o.created_at,
                    COALESCE(p.status, 'unpaid') AS payment_status,
                    COALESCE(p.escrow_status, 'none') AS escrow_status,
                    p.provider AS payment_provider,
                    p.payment_reference,
                    u.username, u.email,
                    oi.order_item_id, oi.service_id, oi.quantity, oi.price, oi.booking_date,
                    s.title
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.order_id
             JOIN services s ON oi.service_id = s.service_id
             JOIN users u ON o.user_id = u.user_id
             LEFT JOIN payments p ON p.order_id = o.order_id
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
