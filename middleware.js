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
const setUserLocals = (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.successMessage = req.session.successMessage || null;
    res.locals.errorMessage = req.session.errorMessage || null;
    
    // Clear messages after displaying
    delete req.session.successMessage;
    delete req.session.errorMessage;
    
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
