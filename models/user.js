const db = require('../db');
const bcrypt = require('bcryptjs');

class User {
    static async create(username, email, phone, password, role = 'buyer') {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            [username, email, phone, hashedPassword, role]
        );
        return result.insertId;
    }

    static async findByEmail(email) {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);
        return rows[0];
    }

    static async findByUsername(username) {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        return rows[0];
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async updateStatus(userId, status) {
        await db.query('UPDATE users SET status = ? WHERE user_id = ?', [status, userId]);
    }

    static async updatePassword(userId, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, userId]);
    }

    static async getAll() {
        const [rows] = await db.query('SELECT user_id, username, email, phone, role, status, created_at FROM users');
        return rows;
    }

    static async search(searchTerm) {
        const [rows] = await db.query(
            'SELECT user_id, username, email, phone, role, status FROM users WHERE user_id = ? OR email LIKE ?',
            [searchTerm, `%${searchTerm}%`]
        );
        return rows;
    }
}

module.exports = User;
