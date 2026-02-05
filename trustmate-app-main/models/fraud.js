const db = require('../db');

class Fraud {
    static async createAlert(userId, alertType, description) {
        const [result] = await db.query(
            'INSERT INTO fraud_alerts (user_id, alert_type, description) VALUES (?, ?, ?)',
            [userId, alertType, description]
        );
        return result.insertId;
    }

    static async getAll() {
        const [rows] = await db.query(
            `SELECT f.*, u.username, u.email, u.status AS user_status
             FROM fraud_alerts f
             LEFT JOIN users u ON f.user_id = u.user_id
             ORDER BY f.created_at DESC`
        );
        return rows;
    }

    static async getPending() {
        const [rows] = await db.query(
            `SELECT f.*, u.username, u.email, u.status AS user_status
             FROM fraud_alerts f
             LEFT JOIN users u ON f.user_id = u.user_id
             WHERE f.status = 'pending'
             ORDER BY f.created_at DESC`
        );
        return rows;
    }

    static async getRecent(limit = 5) {
        const [rows] = await db.query(
            `SELECT f.*, u.username, u.email, u.status AS user_status
             FROM fraud_alerts f
             LEFT JOIN users u ON f.user_id = u.user_id
             ORDER BY f.created_at DESC
             LIMIT ?`,
            [limit]
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.query(
            `SELECT f.*, u.username, u.email, u.status AS user_status
             FROM fraud_alerts f
             LEFT JOIN users u ON f.user_id = u.user_id
             WHERE f.alert_id = ?`,
            [id]
        );
        return rows[0];
    }

    static async getByUser(userId, limit = 5) {
        const [rows] = await db.query(
            `SELECT f.*, u.username, u.email, u.status AS user_status
             FROM fraud_alerts f
             LEFT JOIN users u ON f.user_id = u.user_id
             WHERE f.user_id = ?
             ORDER BY f.created_at DESC
             LIMIT ?`,
            [userId, limit]
        );
        return rows;
    }

    static async updateStatus(id, status) {
        await db.query('UPDATE fraud_alerts SET status = ? WHERE alert_id = ?', [status, id]);
    }

    static async delete(id) {
        await db.query('DELETE FROM fraud_alerts WHERE alert_id = ?', [id]);
    }
}

module.exports = Fraud;
