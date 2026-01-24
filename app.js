const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make user available to all views
const { setUserLocals } = require('./middleware');
app.use(setUserLocals);

// Import controllers
const userController = require('./controllers/userController');
const serviceController = require('./controllers/serviceController');
const categoryController = require('./controllers/categoryController');
const cartController = require('./controllers/cartController');
const orderController = require('./controllers/orderController');
const reviewController = require('./controllers/reviewController');
const sellerController = require('./controllers/sellerController');
const fraudController = require('./controllers/fraudController');
const chatController = require('./controllers/chatController');

// Import middleware
const { isAuthenticated, isAdmin, isSeller } = require('./middleware');

// ===== PUBLIC ROUTES =====
app.get('/', serviceController.index);
app.get('/register', userController.showRegister);
app.post('/register', userController.register);
app.get('/login', userController.showLogin);
app.post('/login', userController.login);
app.get('/logout', userController.logout);
app.get('/2fa/email', userController.showEmail2fa);
app.post('/2fa/email/verify', userController.verifyEmail2fa);
app.get('/2fa/email/resend', userController.resendEmail2fa);
app.get('/2fa/phone', userController.showPhone2fa);
app.post('/2fa/phone/verify', userController.verifyPhone2fa);
app.get('/2fa/phone/resend', userController.resendPhone2fa);
app.get('/faq', (req, res) => {
    res.render('faq');
});

// Services routes
app.get('/services', serviceController.search);
app.get('/services/:id', serviceController.show);

// ===== AUTHENTICATED USER ROUTES =====
app.get('/profile', isAuthenticated, userController.getProfile);

// Cart routes
app.get('/cart', isAuthenticated, cartController.index);
app.post('/cart/add', isAuthenticated, cartController.add);
app.post('/cart/update', isAuthenticated, cartController.update);
app.get('/cart/remove/:id', isAuthenticated, cartController.remove);
app.get('/cart/clear', isAuthenticated, cartController.clear);

// Order routes
app.get('/checkout', isAuthenticated, orderController.showCheckout);
app.post('/orders/create', isAuthenticated, orderController.create);
app.get('/orders', isAuthenticated, orderController.index);
app.get('/orders/:id', isAuthenticated, orderController.show);
app.post('/orders/:id/cancel', isAuthenticated, orderController.cancel);
app.post('/orders/:id/status', isAuthenticated, orderController.updateStatus);

// Review routes
app.get('/reviews/create/:orderId', isAuthenticated, reviewController.showCreate);
app.post('/reviews/create', isAuthenticated, reviewController.create);
app.get('/reviews/edit/:id', isAuthenticated, reviewController.showEdit);
app.post('/reviews/update/:id', isAuthenticated, reviewController.update);
app.get('/reviews/delete/:id', isAuthenticated, reviewController.delete);
app.post('/reviews/:id/reply', isAuthenticated, isSeller, reviewController.reply);

// Chat routes
app.get('/chat/:orderId', isAuthenticated, chatController.show);
app.post('/chat/send', isAuthenticated, chatController.send);
app.get('/chats', isAuthenticated, chatController.index);
app.get('/chat/archive/:id', isAuthenticated, chatController.archive);

// ===== SELLER ROUTES =====
app.get('/seller/register', isAuthenticated, sellerController.showRegister);
app.post('/seller/register', isAuthenticated, sellerController.register);
app.get('/seller/dashboard', isAuthenticated, isSeller, sellerController.dashboard);
app.get('/seller/services', isAuthenticated, isSeller, sellerController.services);

// Seller service management
app.get('/seller/services/create', isAuthenticated, isSeller, serviceController.showCreate);
app.post('/seller/services/create', isAuthenticated, isSeller, serviceController.create);
app.get('/seller/services/edit/:id', isAuthenticated, isSeller, serviceController.showEdit);
app.post('/seller/services/update/:id', isAuthenticated, isSeller, serviceController.update);
app.get('/seller/services/delete/:id', isAuthenticated, isSeller, serviceController.delete);

// ===== ADMIN ROUTES =====
app.get('/admin/dashboard', isAuthenticated, isAdmin, fraudController.dashboard);

// Admin order management
app.get('/admin/orders', isAuthenticated, isAdmin, orderController.adminIndex);
app.get('/admin/orders/:id', isAuthenticated, isAdmin, orderController.adminShow);
app.post('/admin/orders/:id/status', isAuthenticated, isAdmin, orderController.adminUpdateStatus);

// Admin user management
app.get('/admin/users', isAuthenticated, isAdmin, userController.adminIndex);
app.get('/admin/users/search', isAuthenticated, isAdmin, userController.adminSearch);
app.get('/admin/users/freeze/:id', isAuthenticated, isAdmin, userController.adminFreeze);
app.get('/admin/users/unfreeze/:id', isAuthenticated, isAdmin, userController.adminUnfreeze);
app.get('/admin/users/reset-password/:id', isAuthenticated, isAdmin, userController.adminResetPassword);
app.get('/admin/users/history/:id', isAuthenticated, isAdmin, userController.adminHistory);

// Admin fraud detection
app.get('/admin/fraud', isAuthenticated, isAdmin, fraudController.index);
app.post('/admin/fraud/create', isAuthenticated, isAdmin, fraudController.create);
app.post('/admin/fraud/update/:id', isAuthenticated, isAdmin, fraudController.updateStatus);
app.get('/admin/fraud/review/:id', isAuthenticated, isAdmin, fraudController.review);
app.get('/admin/fraud/resolve/:id', isAuthenticated, isAdmin, fraudController.resolve);
app.get('/admin/fraud/delete/:id', isAuthenticated, isAdmin, fraudController.delete);

// Admin category management
app.get('/admin/categories', isAuthenticated, isAdmin, categoryController.index);
app.get('/admin/categories/create', isAuthenticated, isAdmin, categoryController.showCreate);
app.post('/admin/categories/create', isAuthenticated, isAdmin, categoryController.create);
app.get('/admin/categories/edit/:id', isAuthenticated, isAdmin, categoryController.showEdit);
app.post('/admin/categories/update/:id', isAuthenticated, isAdmin, categoryController.update);
app.get('/admin/categories/delete/:id', isAuthenticated, isAdmin, categoryController.delete);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Trustmate server running on http://localhost:${PORT}`);
});
