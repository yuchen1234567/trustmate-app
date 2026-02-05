const db = require('../db');

class Category {
    static async getAll() {
        const [rows] = await db.query('SELECT * FROM categories');
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM categories WHERE category_id = ?', [id]);
        return rows[0];
    }

    static async create(name, description, icon) {
        const [result] = await db.query(
            'INSERT INTO categories (name, description, icon) VALUES (?, ?, ?)',
            [name, description, icon]
        );
        return result.insertId;
    }

    static async update(id, name, description, icon) {
        await db.query(
            'UPDATE categories SET name = ?, description = ?, icon = ? WHERE category_id = ?',
            [name, description, icon, id]
        );
    }

    static async delete(id) {
        await db.query('DELETE FROM categories WHERE category_id = ?', [id]);
    }
}

module.exports = Category;
