const CustomerSupport = require('../models/customerSupport');
const Order = require('../models/order');

// ===== 买家端功能 =====

// 显示创建工单页面
exports.showCreateTicket = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const orders = await Order.getByUser(userId);
        res.render('createSupportTicket', { orders, error: null });
    } catch (error) {
        console.error('Error loading create ticket page:', error);
        res.status(500).send('Error loading page');
    }
};

// 创建新工单
exports.createTicket = async (req, res) => {
    try {
        const { subject, category, priority, order_id, message } = req.body;
        const userId = req.session.user.user_id;

        // 验证必填字段
        if (!subject || !category || !message) {
            const orders = await Order.getByUser(userId);
            return res.render('createSupportTicket', { 
                orders, 
                error: 'Please fill in all required fields' 
            });
        }

        // 创建工单
        const ticketId = await CustomerSupport.createTicket(
            userId,
            subject,
            category,
            priority || 'medium',
            order_id || null
        );

        // 添加初始消息
        await CustomerSupport.addMessage(ticketId, userId, message, false);

        req.session.successMessage = 'Ticket created successfully! Our support team will respond soon.';
        res.redirect(`/support/tickets/${ticketId}`);
    } catch (error) {
        console.error('Error creating ticket:', error);
        const orders = await Order.getByUser(req.session.user.user_id);
        res.render('createSupportTicket', { 
            orders, 
            error: 'Failed to create ticket. Please try again.' 
        });
    }
};

// 查看用户的所有工单
exports.myTickets = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const tickets = await CustomerSupport.getTicketsByUser(userId);
        res.render('mySupportTickets', { tickets });
    } catch (error) {
        console.error('Error loading tickets:', error);
        res.render('mySupportTickets', { tickets: [], error: 'Failed to load tickets' });
    }
};

// 查看工单详情和对话
exports.viewTicket = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const userId = req.session.user.user_id;
        const userRole = req.session.user.role;

        const ticket = await CustomerSupport.getTicketById(ticketId);
        
        if (!ticket) {
            return res.status(404).send('Ticket not found');
        }

        // 权限检查：买家只能查看自己的工单，客服和管理员可以查看所有工单
        if (userRole === 'buyer' && ticket.user_id !== userId) {
            return res.status(403).send('Access denied');
        }

        // 客服可以看到内部备注
        const includeInternal = (userRole === 'customer_service' || userRole === 'admin');
        const messages = await CustomerSupport.getMessages(ticketId, includeInternal);

        res.render('supportTicketDetail', { ticket, messages });
    } catch (error) {
        console.error('Error loading ticket:', error);
        res.status(500).send('Failed to load ticket');
    }
};

// 发送消息到工单
exports.sendMessage = async (req, res) => {
    try {
        const { ticket_id, message, is_internal } = req.body;
        const userId = req.session.user.user_id;
        const userRole = req.session.user.role;

        if (!message || !message.trim()) {
            return res.redirect(`/support/tickets/${ticket_id}`);
        }

        const ticket = await CustomerSupport.getTicketById(ticket_id);
        
        if (!ticket) {
            return res.status(404).send('Ticket not found');
        }

        // 权限检查
        if (userRole === 'buyer' && ticket.user_id !== userId) {
            return res.status(403).send('Access denied');
        }

        // 只有客服和管理员可以添加内部备注
        const isInternalNote = (is_internal === 'true' && (userRole === 'customer_service' || userRole === 'admin'));

        await CustomerSupport.addMessage(ticket_id, userId, message, isInternalNote);

        res.redirect(`/support/tickets/${ticket_id}`);
    } catch (error) {
        console.error('Error sending message:', error);
        res.redirect(`/support/tickets/${req.body.ticket_id}`);
    }
};

// ===== 客服端功能 =====

// 客服仪表板
exports.csDashboard = async (req, res) => {
    try {
        const csUserId = req.session.user.user_id;
        const statistics = await CustomerSupport.getStatistics(csUserId);
        const myTickets = await CustomerSupport.getAllTickets({ assignedTo: csUserId });
        const unassignedTickets = await CustomerSupport.getAllTickets({ status: 'pending' });

        res.render('csDashboard', { statistics, myTickets, unassignedTickets });
    } catch (error) {
        console.error('Error loading CS dashboard:', error);
        res.status(500).send('Failed to load dashboard');
    }
};

// 客服查看所有工单
exports.csAllTickets = async (req, res) => {
    try {
        const { status, category } = req.query;
        const filters = {};
        
        if (status) filters.status = status;
        if (category) filters.category = category;

        const tickets = await CustomerSupport.getAllTickets(filters);
        res.render('csAllTickets', { tickets, filters });
    } catch (error) {
        console.error('Error loading tickets:', error);
        res.render('csAllTickets', { tickets: [], filters: {}, error: 'Failed to load tickets' });
    }
};

// 分配工单给自己
exports.assignToMe = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const csUserId = req.session.user.user_id;

        await CustomerSupport.assignTicket(ticketId, csUserId);
        
        req.session.successMessage = 'Ticket assigned to you successfully';
        res.redirect(`/cs/tickets/${ticketId}`);
    } catch (error) {
        console.error('Error assigning ticket:', error);
        req.session.errorMessage = 'Failed to assign ticket';
        res.redirect('/cs/dashboard');
    }
};

// 更新工单状态
exports.updateStatus = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { status } = req.body;

        if (!['pending', 'in_progress', 'resolved', 'closed'].includes(status)) {
            return res.status(400).send('Invalid status');
        }

        await CustomerSupport.updateTicketStatus(ticketId, status);
        
        req.session.successMessage = 'Ticket status updated successfully';
        res.redirect(`/cs/tickets/${ticketId}`);
    } catch (error) {
        console.error('Error updating status:', error);
        req.session.errorMessage = 'Failed to update status';
        res.redirect(`/cs/tickets/${req.params.id}`);
    }
};

// 更新工单优先级
exports.updatePriority = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { priority } = req.body;

        if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
            return res.status(400).send('Invalid priority');
        }

        await CustomerSupport.updateTicketPriority(ticketId, priority);
        
        req.session.successMessage = 'Priority updated successfully';
        res.redirect(`/cs/tickets/${ticketId}`);
    } catch (error) {
        console.error('Error updating priority:', error);
        req.session.errorMessage = 'Failed to update priority';
        res.redirect(`/cs/tickets/${req.params.id}`);
    }
};

// ===== 管理员功能 =====

// 管理员查看客服统计
exports.adminStatistics = async (req, res) => {
    try {
        const overallStats = await CustomerSupport.getStatistics();
        const allTickets = await CustomerSupport.getAllTickets();
        
        res.render('adminSupportStatistics', { statistics: overallStats, tickets: allTickets });
    } catch (error) {
        console.error('Error loading admin statistics:', error);
        res.status(500).send('Failed to load statistics');
    }
};

// 管理员删除工单
exports.adminDeleteTicket = async (req, res) => {
    try {
        await CustomerSupport.deleteTicket(req.params.id);
        req.session.successMessage = 'Ticket deleted successfully';
        res.redirect('/admin/support/statistics');
    } catch (error) {
        console.error('Error deleting ticket:', error);
        req.session.errorMessage = 'Failed to delete ticket';
        res.redirect('/admin/support/statistics');
    }
};
