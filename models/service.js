const db = require('../db');

class Service {
    static async create(sellerId, title, description, price, categoryId, image) {
        const [result] = await db.query(
            'INSERT INTO services (seller_id, title, description, price, category_id, image) VALUES (?, ?, ?, ?, ?, ?)',
            [sellerId, title, description, price, categoryId, image]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await db.query(
            `SELECT s.*, c.name as category_name, sel.business_name, sel.verified, u.username as seller_name,
                    rv.avg_rating, rv.review_count
             FROM services s
             LEFT JOIN categories c ON s.category_id = c.category_id
             LEFT JOIN sellers sel ON s.seller_id = sel.seller_id
             LEFT JOIN users u ON sel.user_id = u.user_id
             LEFT JOIN (
                 SELECT service_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                 FROM reviews
                 GROUP BY service_id
             ) rv ON rv.service_id = s.service_id
             WHERE s.service_id = ?`,
            [id]
        );
        return rows[0];
    }

    static async getAll() {
        const [rows] = await db.query(
            `SELECT s.*, c.name as category_name, sel.business_name, sel.verified,
                    rv.avg_rating, rv.review_count
             FROM services s
             LEFT JOIN categories c ON s.category_id = c.category_id
             LEFT JOIN sellers sel ON s.seller_id = sel.seller_id
             LEFT JOIN (
                 SELECT service_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                 FROM reviews
                 GROUP BY service_id
             ) rv ON rv.service_id = s.service_id
             WHERE s.status = 'active'
             ORDER BY s.created_at DESC`
        );
        return rows;
    }

    static async getBySeller(sellerId) {
        const [rows] = await db.query(
            `SELECT s.*, c.name as category_name
             FROM services s
             LEFT JOIN categories c ON s.category_id = c.category_id
             WHERE s.seller_id = ?
             ORDER BY s.created_at DESC`,
            [sellerId]
        );
        return rows;
    }

    static async getByCategory(categoryId) {
        const [rows] = await db.query(
            `SELECT s.*, c.name as category_name, sel.business_name, sel.verified,
                    rv.avg_rating, rv.review_count
             FROM services s
             LEFT JOIN categories c ON s.category_id = c.category_id
             LEFT JOIN sellers sel ON s.seller_id = sel.seller_id
             LEFT JOIN (
                 SELECT service_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                 FROM reviews
                 GROUP BY service_id
             ) rv ON rv.service_id = s.service_id
             WHERE s.category_id = ? AND s.status = 'active'
             ORDER BY s.created_at DESC`,
            [categoryId]
        );
        return rows;
    }

    static async search(searchTerm) {
        const [rows] = await db.query(
            `SELECT s.*, c.name as category_name, sel.business_name, sel.verified,
                    rv.avg_rating, rv.review_count
             FROM services s
             LEFT JOIN categories c ON s.category_id = c.category_id
             LEFT JOIN sellers sel ON s.seller_id = sel.seller_id
             LEFT JOIN (
                 SELECT service_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                 FROM reviews
                 GROUP BY service_id
             ) rv ON rv.service_id = s.service_id
             WHERE (s.title LIKE ? OR s.description LIKE ?) AND s.status = 'active'`,
            [`%${searchTerm}%`, `%${searchTerm}%`]
        );
        return rows;
    }

    static async update(id, title, description, price, categoryId, image) {
        await db.query(
            'UPDATE services SET title = ?, description = ?, price = ?, category_id = ?, image = ? WHERE service_id = ?',
            [title, description, price, categoryId, image, id]
        );
    }

    static async updateStatus(id, status) {
        await db.query('UPDATE services SET status = ? WHERE service_id = ?', [status, id]);
    }

    static async delete(id) {
        await db.query('DELETE FROM services WHERE service_id = ?', [id]);
    }
}

module.exports = Service;
