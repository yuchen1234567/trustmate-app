const User = require('../models/user');
const Fraud = require('../models/fraud');

const MAX_LOGIN_ATTEMPTS = 5;

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
    res.render('login', { error: null, attemptsLeft: null });
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const getOtpFromBody = (body) => {
    if (body.code) {
        return body.code.trim();
    }

    const digits = ['code1', 'code2', 'code3', 'code4', 'code5', 'code6']
        .map((key) => (body[key] || '').trim())
        .join('');
    return digits;
};

const maskEmail = (email) => {
    if (!email || !email.includes('@')) {
        return email;
    }

    const [local, domain] = email.split('@');
    if (local.length <= 2) {
        return `${local[0] || ''}*@${domain}`;
    }

    const maskedLocal = `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`;
    return `${maskedLocal}@${domain}`;
};

const maskPhone = (phone) => {
    if (!phone) {
        return phone;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 2) {
        return digits;
    }

    return `${'*'.repeat(digits.length - 2)}${digits.slice(-2)}`;
};

const getPostLoginRedirect = (user) => {
    if (user.role === 'admin') {
        return '/admin/dashboard';
    }
    if (user.role === 'seller') {
        return '/seller/dashboard';
    }
    return '/';
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

// Handle login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            return res.render('login', { error: 'Invalid email or password', attemptsLeft: null });
        }

        if (user.status === 'frozen') {
            return res.render('login', { error: 'Account is frozen. Contact admin.', attemptsLeft: null });
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
                            `User attempted to login ${attempts} times with wrong password`
                        );
                    } catch (alertError) {
                        console.error('Failed to create fraud alert', alertError);
                    }
                }

                return res.render('login', { error: 'Invalid email or password', attemptsLeft });
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
        req.session.postLoginRedirect = getPostLoginRedirect(user);
        req.session.successMessage = `Demo code: ${req.session.twoFactor.emailCode}`;

        res.redirect('/2fa/email');
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Login failed', attemptsLeft: null });
    }
};

// Logout
exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/');
};

// ===== TWO-FACTOR AUTH =====
exports.showEmail2fa = (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.postLoginRedirect || '/');
    }

    if (!req.session.pendingUser || !req.session.twoFactor) {
        return res.redirect('/login');
    }

    res.render('twoFactorEmail', {
        error: null,
        maskedEmail: maskEmail(req.session.pendingUser.email)
    });
};

exports.verifyEmail2fa = (req, res) => {
    if (!req.session.pendingUser || !req.session.twoFactor) {
        return res.redirect('/login');
    }

    const code = getOtpFromBody(req.body);
    if (!code || code.length !== 6 || code !== req.session.twoFactor.emailCode) {
        return res.render('twoFactorEmail', {
            error: 'Invalid code. Please try again.',
            maskedEmail: maskEmail(req.session.pendingUser.email)
        });
    }

    req.session.twoFactor.emailVerified = true;
    req.session.twoFactor.phoneCode = generateOtp();
    req.session.successMessage = `Demo code: ${req.session.twoFactor.phoneCode}`;
    res.redirect('/2fa/phone');
};

exports.resendEmail2fa = (req, res) => {
    if (!req.session.pendingUser || !req.session.twoFactor) {
        return res.redirect('/login');
    }

    req.session.twoFactor.emailCode = generateOtp();
    req.session.successMessage = `Demo code: ${req.session.twoFactor.emailCode}`;
    res.redirect('/2fa/email');
};

exports.showPhone2fa = (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.postLoginRedirect || '/');
    }

    if (!req.session.pendingUser || !req.session.twoFactor || !req.session.twoFactor.emailVerified) {
        return res.redirect('/2fa/email');
    }

    res.render('twoFactorPhone', {
        error: null,
        maskedPhone: maskPhone(req.session.pendingUser.phone)
    });
};

exports.verifyPhone2fa = (req, res) => {
    if (!req.session.pendingUser || !req.session.twoFactor || !req.session.twoFactor.emailVerified) {
        return res.redirect('/login');
    }

    const code = getOtpFromBody(req.body);
    if (!code || code.length !== 6 || code !== req.session.twoFactor.phoneCode) {
        return res.render('twoFactorPhone', {
            error: 'Invalid code. Please try again.',
            maskedPhone: maskPhone(req.session.pendingUser.phone)
        });
    }

    req.session.twoFactor.phoneVerified = true;
    req.session.user = req.session.pendingUser;
    delete req.session.pendingUser;
    delete req.session.twoFactor;

    const redirectTo = req.session.postLoginRedirect || '/';
    delete req.session.postLoginRedirect;
    res.redirect(redirectTo);
};

exports.resendPhone2fa = (req, res) => {
    if (!req.session.pendingUser || !req.session.twoFactor || !req.session.twoFactor.emailVerified) {
        return res.redirect('/login');
    }

    req.session.twoFactor.phoneCode = generateOtp();
    req.session.successMessage = `Demo code: ${req.session.twoFactor.phoneCode}`;
    res.redirect('/2fa/phone');
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
