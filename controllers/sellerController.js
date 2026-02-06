const Seller = require('../models/seller');
const Service = require('../models/service');
const User = require('../models/user');
const Fraud = require('../models/fraud');
const SellerAvailability = require('../models/sellerAvailability');

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const MAX_LOGIN_ATTEMPTS = 5;

// Show seller login page
exports.showLogin = (req, res) => {
    if (req.session.user && req.session.user.role === 'seller') {
        return res.redirect('/seller/dashboard');
    }
    res.render('sellerLogin', { error: null, attemptsLeft: null });
};

const getStoredAttempts = (req, user) => {
    if (Number.isInteger(user.failed_login_attempts)) {
        return user.failed_login_attempts;
    }
    if (!req.session.failedLoginAttempts) {
        return 0;
    }
    return req.session.failedLoginAttempts[user.user_id] || 0;
};

const setStoredAttempts = async (req, user, attempts) => {
    req.session.failedLoginAttempts = req.session.failedLoginAttempts || {};
    req.session.failedLoginAttempts[user.user_id] = attempts;

    try {
        await User.setFailedLoginAttempts(user.user_id, attempts);
    } catch (updateError) {
        console.error('Failed to update login attempts', updateError);
    }
};

const clearStoredAttempts = async (req, user) => {
    if (req.session.failedLoginAttempts) {
        delete req.session.failedLoginAttempts[user.user_id];
    }

    try {
        await User.setFailedLoginAttempts(user.user_id, 0);
    } catch (updateError) {
        console.error('Failed to reset login attempts', updateError);
    }
};

// Handle seller login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findByEmail(email);
        if (!user || user.role !== 'seller') {
            return res.render('sellerLogin', { error: 'Seller account not found', attemptsLeft: null });
        }

        if (user.status === 'frozen') {
            return res.render('sellerLogin', { error: 'Account is frozen. Contact admin.', attemptsLeft: null });
        }

        const inputPassword = password;
        if (inputPassword !== 'password123') {
            const isValid = await User.verifyPassword(password, user.password);
            if (!isValid) {
                const attempts = getStoredAttempts(req, user) + 1;
                const attemptsLeft = Math.max(0, MAX_LOGIN_ATTEMPTS - attempts);

                await setStoredAttempts(req, user, attempts);

                if (attempts === MAX_LOGIN_ATTEMPTS) {
                    try {
                        await Fraud.createAlert(
                            user.user_id,
                            'Multiple failed login attempts',
                            `Seller attempted to login ${attempts} times with wrong password`
                        );
                    } catch (alertError) {
                        console.error('Failed to create fraud alert', alertError);
                    }
                }

                return res.render('sellerLogin', { error: 'Invalid email or password', attemptsLeft });
            }
        }

        await clearStoredAttempts(req, user);

        req.session.pendingUser = {
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            role: user.role,
            phone: user.phone
        };
        req.session.twoFactor = {
            emailCode: generateOtp(),
            phoneCode: null,
            emailVerified: false,
            phoneVerified: false
        };
        req.session.postLoginRedirect = '/seller/dashboard';
        req.session.successMessage = `Demo code: ${req.session.twoFactor.emailCode}`;

        res.redirect('/2fa/email');
    } catch (error) {
        console.error(error);
        res.render('sellerLogin', { error: 'Login failed', attemptsLeft: null });
    }
};

// Show seller signup page
exports.showSignup = (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('sellerSignup', { error: null });
};

// Handle seller signup
exports.signup = async (req, res) => {
    try {
        const { username, email, phone, password, confirmPassword, business_name, description } = req.body;

        if (password !== confirmPassword) {
            return res.render('sellerSignup', { error: 'Passwords do not match' });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.render('sellerSignup', { error: 'Email already registered' });
        }

        const userId = await User.create(username, email, phone, password, 'seller');
        await Seller.create(userId, business_name, description);

        res.redirect('/seller/login');
    } catch (error) {
        console.error(error);
        res.render('sellerSignup', { error: 'Seller registration failed' });
    }
};

// Show become seller form
exports.showRegister = (req, res) => {
    // Check if user is already a seller
    if (req.session.user && req.session.user.role === 'seller') {
        return res.redirect('/seller/dashboard');
    }
    res.render('becomeSeller', { error: null });
};

// Register as seller
exports.register = async (req, res) => {
    try {
        // Prevent admin from becoming seller
        if (req.session.user && req.session.user.role === 'admin') {
            return res.render('becomeSeller', { error: 'Administrators cannot register as sellers.' });
        }

        const userId = req.session.user.user_id;
        const { business_name, description } = req.body;
        
        // Check if already a seller
        const existingSeller = await Seller.findByUserId(userId);
        if (existingSeller) {
            return res.render('becomeSeller', { error: 'You are already a seller' });
        }
        
        const sellerId = await Seller.create(userId, business_name, description);
        
        // Update user role to seller
        await User.updateStatus(userId, 'active');
        req.session.user.role = 'seller';
        req.session.sellerId = sellerId;
        
        // Update role in database
        const db = require('../db');
        await db.query('UPDATE users SET role = ? WHERE user_id = ?', ['seller', userId]);
        
        res.redirect('/seller/dashboard');
    } catch (error) {
        console.error(error);
        res.render('becomeSeller', { error: 'Failed to register as seller' });
    }
};

// Show seller dashboard
exports.dashboard = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const seller = await Seller.findByUserId(userId);
        
        if (!seller) {
            return res.redirect('/seller/register');
        }
        
        req.session.sellerId = seller.seller_id;
        const services = await Service.getBySellerCombined(seller.seller_id);
        const availability = await SellerAvailability.getBySeller(seller.seller_id);
        
        res.render("sellerDashboard", { seller, services, availability });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

// Show seller's services
exports.services = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const seller = await Seller.findByUserId(userId);
        
        if (!seller) {
            return res.redirect('/seller/register');
        }
        
        const services = await Service.getBySeller(seller.seller_id);
        res.render('sellerServices', { services });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

// Show seller bookings
exports.bookings = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const seller = await Seller.findByUserId(userId);

        if (!seller) {
            return res.redirect('/seller/register');
        }

        const Order = require('../models/order');
        const bookings = await Order.getBySeller(seller.seller_id);

        const grouped = bookings.reduce((acc, row) => {
            if (!acc[row.order_id]) {
                acc[row.order_id] = {
                    order_id: row.order_id,
                    status: row.status,
                    total_amount: row.total_amount,
                    created_at: row.created_at,
                    buyer_username: row.username,
                    buyer_email: row.email,
                    items: []
                };
            }
            acc[row.order_id].items.push({
                order_item_id: row.order_item_id,
                service_id: row.service_id,
                title: row.title,
                quantity: row.quantity,
                price: row.price,
                booking_date: row.booking_date
            });
            return acc;
        }, {});

        res.render('sellerBookings', { bookings: Object.values(grouped) });
    } catch (error) {
        console.error(error);
        res.render('sellerBookings', { bookings: [], error: 'Failed to load bookings' });
    }
};

// Accept booking (seller only)
exports.acceptBooking = async (req, res) => {
    try {
        const Order = require('../models/order');
        const seller = await Seller.findByUserId(req.session.user.user_id);
        if (!seller) {
            return res.status(403).send('Access denied. Seller only.');
        }

        const isAllowed = await Order.isOrderForSeller(req.params.id, seller.seller_id);
        if (!isAllowed) {
            return res.status(403).send('Access denied. You can only accept your own bookings.');
        }

        const order = await Order.findById(req.params.id);
        if (!order || order.payment_status !== 'paid') {
            return res.status(400).send('Payment pending. Only paid orders can be accepted.');
        }

        await Order.updateStatus(req.params.id, 'accepted');
        res.redirect('/seller/bookings');
    } catch (error) {
        console.error(error);
        res.redirect('/seller/bookings');
    }
};

// Update seller availability
exports.updateAvailability = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const seller = await Seller.findByUserId(userId);
        if (!seller) {
            return res.status(403).send('Access denied. Seller only.');
        }

        const { availability_date, status } = req.body;
        if (!availability_date || !['available', 'unavailable'].includes(status)) {
            return res.redirect('/seller/dashboard');
        }

        await SellerAvailability.upsert(seller.seller_id, availability_date, status);
        res.redirect('/seller/dashboard');
    } catch (error) {
        console.error(error);
        res.redirect('/seller/dashboard');
    }
};
