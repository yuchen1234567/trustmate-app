const db = require('../db');

class OrderItem {
    static async create(orderId, serviceId, quantity, price, bookingDate) {
        const [result] = await db.query(
            'INSERT INTO order_items (order_id, service_id, quantity, price, booking_date) VALUES (?, ?, ?, ?, ?)',
            [orderId, serviceId, quantity, price, bookingDate]
        );
        return result.insertId;
    }

    static async getByOrder(orderId) {
        const [rows] = await db.query(
            `SELECT oi.*, s.title, s.description, s.image, s.seller_id, sel.business_name, sel.user_id AS seller_user_id
             FROM order_items oi
             JOIN services s ON oi.service_id = s.service_id
             LEFT JOIN sellers sel ON s.seller_id = sel.seller_id
             WHERE oi.order_id = ?`,
            [orderId]
        );
        return rows;
    }

    static async hasPaidBooking(serviceId, bookingDate) {
        const [rows] = await db.query(
            `SELECT 1
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.order_id
             JOIN payments p ON p.order_id = o.order_id
             WHERE oi.service_id = ?
               AND oi.booking_date = ?
               AND p.status = 'paid'
               AND o.status <> 'cancelled'
             LIMIT 1`,
            [serviceId, bookingDate]
        );
        return rows.length > 0;
    }

    static async delete(id) {
        await db.query('DELETE FROM order_items WHERE order_item_id = ?', [id]);
    }
}

module.exports = OrderItem;
