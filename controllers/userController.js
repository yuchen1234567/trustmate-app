const User = require('../models/user');

// Show register page
exports.showRegister = (req, res) => {
    res.render('register', { error: null });
};

// Handle registration
exports.register = async (req, res) => {
    try {
        const { username, email, phone, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('register', { error: 'Passwords do not match' });
        }

        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.render('register', { error: 'Email already registered' });
        }

        const userId = await User.create(username, email, phone, password);
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'Registration failed' });
    }
};

// Show login page
exports.showLogin = (req, res) => {
    res.render('login', { error: null });
};

// Handle login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        if (user.status === 'frozen') {
            return res.render('login', { error: 'Account is frozen. Contact admin.' });
        }

        const isValid = await User.verifyPassword(password, user.password);
        if (!isValid) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        req.session.user = {
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            role: user.role
        };

        // Redirect based on role
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Login failed' });
    }
};

// Logout
exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/');
};

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.user_id);
        res.render('profile', { user });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

// ===== ADMIN FUNCTIONS =====

// Show admin user management
exports.adminIndex = async (req, res) => {
    try {
        const users = await User.getAll();
        res.render('adminUsers', { users, searchResults: null });
    } catch (error) {
        console.error(error);
        res.render('adminUsers', { users: [], searchResults: null, error: 'Failed to load users' });
    }
};

// Search users
exports.adminSearch = async (req, res) => {
    try {
        const { search } = req.query;
        const searchResults = await User.search(search);
        const users = await User.getAll();
        
        res.render('adminUsers', { users, searchResults });
    } catch (error) {
        console.error(error);
        res.render('adminUsers', { users: [], searchResults: null, error: 'Search failed' });
    }
};

// Freeze user account
exports.adminFreeze = async (req, res) => {
    try {
        await User.updateStatus(req.params.id, 'frozen');
        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/users');
    }
};

// Unfreeze user account
exports.adminUnfreeze = async (req, res) => {
    try {
        await User.updateStatus(req.params.id, 'active');
        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/users');
    }
};

// Reset user password
exports.adminResetPassword = async (req, res) => {
    try {
        const newPassword = 'password123'; // Default password
        await User.updatePassword(req.params.id, newPassword);
        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/users');
    }
};

// View user history
exports.adminHistory = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const Order = require('../models/order');
        const orders = await Order.getByUser(req.params.id);
        
        res.render('adminUserHistory', { user, orders });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/users');
    }
};
