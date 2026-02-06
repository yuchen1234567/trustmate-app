const db = require('../db');

class Cart {
    static bookingDateColumnAvailable = null;

    static async hasBookingDateColumn() {
        if (Cart.bookingDateColumnAvailable !== null) {
            return Cart.bookingDateColumnAvailable;
        }

        try {
            const [rows] = await db.query(
                `SELECT COUNT(*) AS count
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'cart'
                   AND COLUMN_NAME = 'booking_date'`
            );
            Cart.bookingDateColumnAvailable = rows[0].count > 0;
        } catch (error) {
            Cart.bookingDateColumnAvailable = false;
        }

        return Cart.bookingDateColumnAvailable;
    }

    static async ensureBookingDateColumn() {
        const hasColumn = await Cart.hasBookingDateColumn();
        if (hasColumn) {
            return true;
        }

        try {
            await db.query('ALTER TABLE cart ADD COLUMN booking_date DATE NULL');
            Cart.bookingDateColumnAvailable = true;
            return true;
        } catch (error) {
            Cart.bookingDateColumnAvailable = false;
            return false;
        }
    }

    static async add(userId, serviceId, bookingDate, quantity = 1) {
        await Cart.ensureBookingDateColumn();
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
