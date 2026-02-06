const db = require('../db');

class Cart {
    static async add(userId, serviceId, bookingDate, quantity = 1) {
        // Check if item already exists in cart
        const [existing] = await db.query(
            'SELECT * FROM cart WHERE user_id = ? AND service_id = ? AND booking_date = ?',
            [userId, serviceId, bookingDate]
        );

        if (existing.length > 0) {
            // Update quantity
            await db.query(
                'UPDATE cart SET quantity = quantity + ? WHERE cart_id = ?',
                [quantity, existing[0].cart_id]
            );
            return existing[0].cart_id;
        } else {
            // Insert new item
            const [result] = await db.query(
                'INSERT INTO cart (user_id, service_id, booking_date, quantity) VALUES (?, ?, ?, ?)',
                [userId, serviceId, bookingDate, quantity]
            );
            return result.insertId;
        }
    }

    static async getByUser(userId) {
        const [rows] = await db.query(
            `SELECT c.*, s.title, s.description, s.price, s.image, s.seller_id, sel.business_name
             FROM cart c
             JOIN services s ON c.service_id = s.service_id
             LEFT JOIN sellers sel ON s.seller_id = sel.seller_id
             WHERE c.user_id = ?`,
            [userId]
        );
        return rows;
    }

    static async updateQuantity(cartId, quantity) {
        await db.query('UPDATE cart SET quantity = ? WHERE cart_id = ?', [quantity, cartId]);
    }

    static async remove(cartId) {
        await db.query('DELETE FROM cart WHERE cart_id = ?', [cartId]);
    }

    static async clearUserCart(userId) {
        await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);
    }

    static async getTotal(userId) {
        const [rows] = await db.query(
            `SELECT SUM(c.quantity * s.price) as total
             FROM cart c
             JOIN services s ON c.service_id = s.service_id
             WHERE c.user_id = ?`,
            [userId]
        );
        return rows[0].total || 0;
    }
}

module.exports = Cart;
