const db = require('../db');

class OrderItem {
    static async create(orderId, serviceId, quantity, price) {
        const [result] = await db.query(
            'INSERT INTO order_items (order_id, service_id, quantity, price) VALUES (?, ?, ?, ?)',
            [orderId, serviceId, quantity, price]
        );
        return result.insertId;
    }

    static async getByOrder(orderId) {
        const [rows] = await db.query(
            `SELECT oi.*, s.title, s.description, s.image, sel.business_name
             FROM order_items oi
             JOIN services s ON oi.service_id = s.service_id
             LEFT JOIN sellers sel ON s.seller_id = sel.seller_id
             WHERE oi.order_id = ?`,
            [orderId]
        );
        return rows;
    }

    static async delete(id) {
        await db.query('DELETE FROM order_items WHERE order_item_id = ?', [id]);
    }
}

module.exports = OrderItem;
