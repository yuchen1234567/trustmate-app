const db = require('../db');

class Review {
    static async create(orderId, userId, serviceId, rating, comment, tags) {
        const [result] = await db.query(
            'INSERT INTO reviews (order_id, user_id, service_id, rating, comment, tags) VALUES (?, ?, ?, ?, ?, ?)',
            [orderId, userId, serviceId, rating, comment, tags]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await db.query(
            `SELECT r.*, u.username, s.title as service_title
             FROM reviews r
             JOIN users u ON r.user_id = u.user_id
             JOIN services s ON r.service_id = s.service_id
             WHERE r.review_id = ?`,
            [id]
        );
        return rows[0];
    }

    static async getByService(serviceId) {
        const [rows] = await db.query(
            `SELECT r.*, u.username
             FROM reviews r
             JOIN users u ON r.user_id = u.user_id
             WHERE r.service_id = ?
             ORDER BY r.created_at DESC`,
            [serviceId]
        );
        return rows;
    }

    static async getByOrder(orderId) {
        const [rows] = await db.query(
            `SELECT r.*, u.username, s.title as service_title
             FROM reviews r
             JOIN users u ON r.user_id = u.user_id
             JOIN services s ON r.service_id = s.service_id
             WHERE r.order_id = ?`,
            [orderId]
        );
        return rows[0];
    }

    static async update(id, rating, comment, tags) {
        await db.query(
            'UPDATE reviews SET rating = ?, comment = ?, tags = ? WHERE review_id = ?',
            [rating, comment, tags, id]
        );
    }

    static async updateReply(id, reply) {
        await db.query(
            'UPDATE reviews SET seller_reply = ?, seller_reply_at = NOW() WHERE review_id = ?',
            [reply, id]
        );
    }

    static async delete(id) {
        await db.query('DELETE FROM reviews WHERE review_id = ?', [id]);
    }

    static async getAverageRating(serviceId) {
        const [rows] = await db.query(
            'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE service_id = ?',
            [serviceId]
        );
        return rows[0];
    }
}

module.exports = Review;
