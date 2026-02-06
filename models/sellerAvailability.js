const db = require('../db');

class SellerAvailability {
    static async upsert(sellerId, date, status) {
        await db.query(
            `INSERT INTO seller_availability (seller_id, availability_date, status)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [sellerId, date, status]
        );
    }

    static async getBySeller(sellerId) {
        const [rows] = await db.query(
            `SELECT availability_date, status
             FROM seller_availability
             WHERE seller_id = ?
             ORDER BY availability_date ASC`,
            [sellerId]
        );
        return rows;
    }

    static async isAvailable(sellerId, date) {
        const [availableRows] = await db.query(
            `SELECT 1
             FROM seller_availability
             WHERE seller_id = ? AND status = 'available'
             LIMIT 1`,
            [sellerId]
        );

        if (availableRows.length > 0) {
            const [rows] = await db.query(
                `SELECT 1
                 FROM seller_availability
                 WHERE seller_id = ? AND availability_date = ? AND status = 'available'
                 LIMIT 1`,
                [sellerId, date]
            );
            return rows.length > 0;
        }

        const [unavailableRows] = await db.query(
            `SELECT 1
             FROM seller_availability
             WHERE seller_id = ? AND availability_date = ? AND status = 'unavailable'
             LIMIT 1`,
            [sellerId, date]
        );
        return unavailableRows.length === 0;
    }
}

module.exports = SellerAvailability;
