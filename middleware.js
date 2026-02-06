const Fraud = require('./models/fraud');

const COOLDOWN_ALERT_TYPE = 'High-value transactions in short time';
const COOLDOWN_MINUTES = 1;

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login');
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).send('Access denied. Admin only.');
};

// Check if user is seller
const isSeller = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'seller') {
        return next();
    }
    res.status(403).send('Access denied. Seller only.');
};

// Check if user is customer service
const isCustomerService = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'customer_service') {
        return next();
    }
    res.status(403).send('Access denied. Customer Service only.');
};

// Check if user is customer service or admin
const isCSOrAdmin = (req, res, next) => {
    if (req.session && req.session.user && 
        (req.session.user.role === 'customer_service' || req.session.user.role === 'admin')) {
        return next();
    }
    res.status(403).send('Access denied. Customer Service or Admin only.');
};

// Make user available to all views
const setUserLocals = async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.successMessage = req.session.successMessage || null;
    res.locals.errorMessage = req.session.errorMessage || null;
    
    // Clear messages after displaying
    delete req.session.successMessage;
    delete req.session.errorMessage;

    res.locals.cooldownRemainingSeconds = 0;
    res.locals.cooldownEndsAt = null;
    req.cooldownRemainingSeconds = 0;

    if (res.locals.user) {
        try {
            const remainingSeconds = await Fraud.getCooldownRemainingSeconds(
                res.locals.user.user_id,
                COOLDOWN_ALERT_TYPE,
                COOLDOWN_MINUTES
            );
            if (remainingSeconds > 0) {
                const expiresAt = Date.now() + remainingSeconds * 1000;
                res.locals.cooldownRemainingSeconds = remainingSeconds;
                res.locals.cooldownEndsAt = expiresAt;
                req.cooldownRemainingSeconds = remainingSeconds;
            }
        } catch (error) {
            console.error('Failed to compute cooldown status', error);
        }
    }
    
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isSeller,
    isCustomerService,
    isCSOrAdmin,
    setUserLocals
};
