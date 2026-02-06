const db = require('../db');

class CustomerSupport {
    // 创建新工单
    static async createTicket(userId, subject, category, priority, orderId = null) {
        const [result] = await db.query(
            `INSERT INTO customer_support_tickets (user_id, subject, category, priority, order_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, subject, category, priority, orderId]
        );
        return result.insertId;
    }

    // 获取工单详情
    static async getTicketById(ticketId) {
        const [rows] = await db.query(
            `SELECT t.*, 
                    u.username as user_name, u.email as user_email,
                    cs.username as assigned_name
             FROM customer_support_tickets t
             LEFT JOIN users u ON t.user_id = u.user_id
             LEFT JOIN users cs ON t.assigned_to = cs.user_id
             WHERE t.ticket_id = ?`,
            [ticketId]
        );
        return rows[0];
    }

    // 获取用户的所有工单
    static async getTicketsByUser(userId) {
        const [rows] = await db.query(
            `SELECT t.*, 
                    cs.username as assigned_name,
                    (SELECT COUNT(*) FROM customer_support_messages 
                     WHERE ticket_id = t.ticket_id) as message_count
             FROM customer_support_tickets t
             LEFT JOIN users cs ON t.assigned_to = cs.user_id
             WHERE t.user_id = ?
             ORDER BY t.created_at DESC`,
            [userId]
        );
        return rows;
    }

    // 获取所有工单（客服用）
    static async getAllTickets(filters = {}) {
        let query = `
            SELECT t.*, 
                   u.username as user_name, u.email as user_email,
                   cs.username as assigned_name,
                   (SELECT COUNT(*) FROM customer_support_messages 
                    WHERE ticket_id = t.ticket_id) as message_count,
                   (SELECT message FROM customer_support_messages 
                    WHERE ticket_id = t.ticket_id 
                    ORDER BY created_at DESC LIMIT 1) as last_message
            FROM customer_support_tickets t
            LEFT JOIN users u ON t.user_id = u.user_id
            LEFT JOIN users cs ON t.assigned_to = cs.user_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (filters.status) {
            query += ` AND t.status = ?`;
            params.push(filters.status);
        }
        
        if (filters.assignedTo) {
            query += ` AND t.assigned_to = ?`;
            params.push(filters.assignedTo);
        }
        
        if (filters.category) {
            query += ` AND t.category = ?`;
            params.push(filters.category);
        }
        
        query += ` ORDER BY 
                   CASE t.priority 
                       WHEN 'urgent' THEN 1 
                       WHEN 'high' THEN 2 
                       WHEN 'medium' THEN 3 
                       WHEN 'low' THEN 4 
                   END,
                   t.created_at DESC`;
        
        const [rows] = await db.query(query, params);
        return rows;
    }

    // 分配工单给客服
    static async assignTicket(ticketId, csUserId) {
        await db.query(
            `UPDATE customer_support_tickets 
             SET assigned_to = ?, status = 'in_progress', updated_at = NOW()
             WHERE ticket_id = ?`,
            [csUserId, ticketId]
        );
    }

    // 更新工单状态
    static async updateTicketStatus(ticketId, status) {
        const resolvedAt = (status === 'resolved' || status === 'closed') ? new Date() : null;
        await db.query(
            `UPDATE customer_support_tickets 
             SET status = ?, resolved_at = ?, updated_at = NOW()
             WHERE ticket_id = ?`,
            [status, resolvedAt, ticketId]
        );
    }

    // 更新工单优先级
    static async updateTicketPriority(ticketId, priority) {
        await db.query(
            `UPDATE customer_support_tickets 
             SET priority = ?, updated_at = NOW()
             WHERE ticket_id = ?`,
            [priority, ticketId]
        );
    }

    // 添加消息到工单
    static async addMessage(ticketId, senderId, message, isInternal = false) {
        const [result] = await db.query(
            `INSERT INTO customer_support_messages (ticket_id, sender_id, message, is_internal) 
             VALUES (?, ?, ?, ?)`,
            [ticketId, senderId, message, isInternal ? 1 : 0]
        );
        
        // 更新工单的updated_at时间
        await db.query(
            `UPDATE customer_support_tickets SET updated_at = NOW() WHERE ticket_id = ?`,
            [ticketId]
        );
        
        return result.insertId;
    }

    // 获取工单的所有消息
    static async getMessages(ticketId, includeInternal = false) {
        let query = `
            SELECT m.*, u.username, u.role
            FROM customer_support_messages m
            LEFT JOIN users u ON m.sender_id = u.user_id
            WHERE m.ticket_id = ?
        `;
        
        if (!includeInternal) {
            query += ` AND m.is_internal = 0`;
        }
        
        query += ` ORDER BY m.created_at ASC`;
        
        const [rows] = await db.query(query, [ticketId]);
        return rows;
    }

    // 获取客服统计数据
    static async getStatistics(csUserId = null) {
        let query = `
            SELECT 
                COUNT(*) as total_tickets,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_tickets,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_tickets,
                SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent_tickets,
                SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_tickets
            FROM customer_support_tickets
        `;
        
        const params = [];
        if (csUserId) {
            query += ` WHERE assigned_to = ?`;
            params.push(csUserId);
        }
        
        const [rows] = await db.query(query, params);
        return rows[0];
    }

    // 删除工单（仅管理员）
    static async deleteTicket(ticketId) {
        await db.query(`DELETE FROM customer_support_tickets WHERE ticket_id = ?`, [ticketId]);
    }
}

module.exports = CustomerSupport;
