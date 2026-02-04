const Fraud = require('../models/fraud');
const User = require('../models/user');

// Show fraud dashboard
exports.dashboard = async (req, res) => {
    try {
        const alerts = await Fraud.getRecent(5);
        const flaggedUsers = [];
        const seen = new Set();
        alerts.forEach(alert => {
            if (alert.user_id && !seen.has(alert.user_id)) {
                flaggedUsers.push({
                    user_id: alert.user_id,
                    username: alert.username,
                    email: alert.email,
                    status: alert.user_status
                });
                seen.add(alert.user_id);
            }
        });
        res.render('fraudDashboard', { alerts, flaggedUsers });
    } catch (error) {
        console.error(error);
        res.render('fraudDashboard', { alerts: [], flaggedUsers: [], error: 'Failed to load alerts' });
    }
};

// Show all fraud alerts
exports.index = async (req, res) => {
    try {
        const alerts = await Fraud.getAll();
        res.render('fraudAlerts', { alerts });
    } catch (error) {
        console.error(error);
        res.render('fraudAlerts', { alerts: [], error: 'Failed to load alerts' });
    }
};

// Create fraud alert
exports.create = async (req, res) => {
    try {
        const { user_id, alert_type, description } = req.body;
        await Fraud.createAlert(user_id, alert_type, description);
        res.redirect('/admin/fraud');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/fraud');
    }
};

// Update alert status
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        await Fraud.updateStatus(req.params.id, status);
        res.redirect('/admin/fraud');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/fraud');
    }
};

// Mark as reviewed
exports.review = async (req, res) => {
    try {
        const alert = await Fraud.findById(req.params.id);
        if (!alert) {
            return res.redirect('/admin/fraud');
        }
        await Fraud.updateStatus(req.params.id, 'reviewed');
        const history = alert.user_id ? await Fraud.getByUser(alert.user_id, 5) : [];
        res.render('fraudReview', { alert, history });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/fraud');
    }
};

// Mark as resolved
exports.resolve = async (req, res) => {
    try {
        await Fraud.updateStatus(req.params.id, 'resolved');
        res.redirect('/admin/fraud');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/fraud');
    }
};

// Delete alert
exports.delete = async (req, res) => {
    try {
        await Fraud.delete(req.params.id);
        res.redirect('/admin/fraud');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/fraud');
    }
};
