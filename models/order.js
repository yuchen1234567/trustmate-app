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

    static async updateStatus(id, status) {
        await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, id]);
    }

    static async delete(id) {
        await db.query('DELETE FROM orders WHERE order_id = ?', [id]);
    }
}

module.exports = Order;
