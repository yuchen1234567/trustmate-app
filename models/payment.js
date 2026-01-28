const db = require('../db');

const allowedFields = new Set([
    'provider',
    'amount',
    'currency',
    'status',
    'escrow_status',
    'payment_reference',
    'provider_txn_id',
    'refund_reason',
    'refunded_at'
]);

class Payment {
    static async create({ orderId, userId, provider, amount, currency = 'SGD', status = 'unpaid', escrowStatus = 'none' }) {
        const [result] = await db.query(
            `INSERT INTO payments
             (order_id, user_id, provider, amount, currency, status, escrow_status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, userId, provider, amount, currency, status, escrowStatus]
        );
        return result.insertId;
    }

    static async findByOrderId(orderId) {
        const [rows] = await db.query(
            'SELECT * FROM payments WHERE order_id = ? LIMIT 1',
            [orderId]
        );
        return rows[0] || null;
    }

    static async updateByOrderId(orderId, fields) {
        const updates = [];
        const values = [];

        Object.entries(fields || {}).forEach(([key, value]) => {
            if (!allowedFields.has(key)) {
                return;
            }
            updates.push(`${key} = ?`);
            values.push(value);
        });

        if (updates.length === 0) {
            return;
        }

        values.push(orderId);
        await db.query(
            `UPDATE payments SET ${updates.join(', ')} WHERE order_id = ?`,
            values
        );
    }

    static async updateByReference(paymentReference, fields) {
        const updates = [];
        const values = [];

        Object.entries(fields || {}).forEach(([key, value]) => {
            if (!allowedFields.has(key)) {
                return;
            }
            updates.push(`${key} = ?`);
            values.push(value);
        });

        if (updates.length === 0) {
            return;
        }

        values.push(paymentReference);
        await db.query(
            `UPDATE payments SET ${updates.join(', ')} WHERE payment_reference = ?`,
            values
        );
    }

    static async markRefunded(orderId, reason) {
        await db.query(
            `UPDATE payments
             SET status = 'refunded',
                 escrow_status = 'refunded',
                 refund_reason = ?,
                 refunded_at = NOW()
             WHERE order_id = ?`,
            [reason || null, orderId]
        );
    }
}

module.exports = Payment;
