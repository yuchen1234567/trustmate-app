const db = require('../db');

class Seller {
    static async create(userId, businessName, description) {
        const [result] = await db.query(
            'INSERT INTO sellers (user_id, business_name, description) VALUES (?, ?, ?)',
            [userId, businessName, description]
        );
        return result.insertId;
    }

    static async findByUserId(userId) {
        const [rows] = await db.query('SELECT * FROM sellers WHERE user_id = ?', [userId]);
        return rows[0];
    }

    static async findById(sellerId) {
        const [rows] = await db.query('SELECT * FROM sellers WHERE seller_id = ?', [sellerId]);
        return rows[0];
    }

    static async update(sellerId, businessName, description) {
        await db.query(
            'UPDATE sellers SET business_name = ?, description = ? WHERE seller_id = ?',
            [businessName, description, sellerId]
        );
    }

    static async verify(sellerId) {
        await db.query('UPDATE sellers SET verified = TRUE WHERE seller_id = ?', [sellerId]);
    }
}

module.exports = Seller;
