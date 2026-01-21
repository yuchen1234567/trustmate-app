const Fraud = require('../models/fraud');
const User = require('../models/user');

// Show fraud dashboard
exports.dashboard = async (req, res) => {
    try {
        const alerts = await Fraud.getPending();
        res.render('fraudDashboard', { alerts });
    } catch (error) {
        console.error(error);
        res.render('fraudDashboard', { alerts: [], error: 'Failed to load alerts' });
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
        await Fraud.updateStatus(req.params.id, 'reviewed');
        res.redirect('/admin/fraud');
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
