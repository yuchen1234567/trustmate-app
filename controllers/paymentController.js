const Cart = require('../models/cart');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const Payment = require('../models/payment');
const Fraud = require('../models/fraud');
const nets = require('../services/nets');
const airwallex = require('../services/airwallex');
const QRCode = require('qrcode');
const paymentService = require('../services/paymentService');
const SellerAvailability = require('../models/sellerAvailability');

const HIGH_VALUE_THRESHOLD = 2000;
const HIGH_VALUE_WINDOW_MINUTES = 5;
const HIGH_VALUE_MIN_COUNT = 3;

const flagHighValueOrder = async (userId, orderId, total) => {
    const amount = Number(total || 0);
    if (amount < HIGH_VALUE_THRESHOLD) {
        return;
    }

    try {
        const recentHighValueCount = await Order.countHighValueByUserWithin(
            userId,
            HIGH_VALUE_THRESHOLD,
            HIGH_VALUE_WINDOW_MINUTES
        );
        if (recentHighValueCount < HIGH_VALUE_MIN_COUNT) {
            return;
        }
        await Fraud.createAlert(
            userId,
            'High-value transactions in short time',
            `User made ${recentHighValueCount} transactions of ${HIGH_VALUE_THRESHOLD} or more within ${HIGH_VALUE_WINDOW_MINUTES} minutes. Latest order #${orderId} total ${amount.toFixed(2)}.`
        );
    } catch (error) {
        console.error('Failed to create high-value alert', error);
    }
};

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    const stripeModule = require('stripe');
    stripe = stripeModule(process.env.STRIPE_SECRET_KEY);
}

const paypal = require('@paypal/checkout-server-sdk');
let paypalClient = null;
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    const Environment = process.env.NODE_ENV === 'production'
        ? paypal.core.LiveEnvironment
        : paypal.core.SandboxEnvironment;
    const paypalEnv = new Environment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
    paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);
}

const createOrderFromCart = async (userId, { provider = 'nets', currency = 'SGD' } = {}) => {
    const cartItems = await Cart.getByUser(userId);
    if (cartItems.length === 0) {
        return null;
    }

    const resolvedCurrency = paymentService.resolveCurrency(currency);
    const total = await Cart.getTotal(userId);
    for (const item of cartItems) {
        if (!item.booking_date) {
            throw new Error('Missing booking date for cart item.');
        }
        const isAvailable = await SellerAvailability.isAvailable(item.seller_id, item.booking_date);
        if (!isAvailable) {
            const error = new Error(`Booking date unavailable for ${item.title}.`);
            error.code = 'BOOKING_DATE_UNAVAILABLE';
            throw error;
        }
        const hasConflict = await OrderItem.hasPaidBooking(item.service_id, item.booking_date);
        if (hasConflict) {
            const error = new Error(`Booking date already taken for ${item.title}.`);
            error.code = 'BOOKING_DATE_TAKEN';
            throw error;
        }
    }
    const orderId = await Order.create(userId, total);
    await Order.updateStatus(orderId, 'pending_payment');

    for (const item of cartItems) {
        await OrderItem.create(orderId, item.service_id, item.quantity, item.price, item.booking_date);
    }

    await Payment.create({
        orderId,
        userId,
        provider,
        amount: total,
        currency: resolvedCurrency,
        status: 'pending',
        escrowStatus: 'none'
    });

    await flagHighValueOrder(userId, orderId, total);

    await Cart.clearUserCart(userId);
    return { orderId, total, currency: resolvedCurrency };
};

const isNetsSuccess = (result) => {
    if (!result || !result.data) {
        return false;
    }
    const data = result.data;
    return data.response_code === '00' && Number(data.txn_status) === 1;
};

const isNetsFailure = (result, frontendTimeoutStatus) => {
    if (!result || !result.data) {
        return false;
    }
    const data = result.data;
    return frontendTimeoutStatus === 1 && (data.response_code !== '00' || Number(data.txn_status) === 2);
};

exports.startNetsPayment = async (req, res) => {
    let orderId;
    try {
        const userId = req.session.user.user_id;
        const orderData = await createOrderFromCart(userId);

        if (!orderData) {
            return res.redirect('/cart');
        }

        orderId = orderData.orderId;
        const amount = Number(orderData.total || 0).toFixed(2);
        const response = await nets.requestQrCode({ amount });
        const qrData = response?.result?.data;

        if (!isNetsSuccess({ data: qrData })) {
            await Payment.updateByOrderId(orderId, { status: 'failed' });
            await Order.updateStatus(orderId, 'cancelled');
            return res.render('netsTxnFailStatus', {
                message: 'Transaction Failed. Please try again.',
                orderId
            });
        }

        await Payment.updateByOrderId(orderId, {
            payment_reference: qrData.txn_retrieval_ref,
            provider: 'nets',
            status: 'pending'
        });

        return res.render('netsQr', {
            title: 'Scan to Pay',
            total: amount,
            qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
            txnRetrievalRef: qrData.txn_retrieval_ref,
            orderId
        });
    } catch (error) {
        console.error('NETS start payment error:', error);
        if (error.code === 'BOOKING_DATE_UNAVAILABLE' || error.code === 'BOOKING_DATE_TAKEN') {
            req.session.errorMessage = error.message;
            return res.redirect('/cart');
        }
        if (orderId) {
            try {
                await Payment.updateByOrderId(orderId, { status: 'failed' });
                await Order.updateStatus(orderId, 'cancelled');
            } catch (updateError) {
                console.error('Failed to mark payment as failed:', updateError);
            }
        }
        res.render('netsTxnFailStatus', {
            message: 'Unable to start NETS payment. Please try again.',
            orderId: orderId || null
        });
    }
};

exports.retryNetsPayment = async (req, res) => {
    let orderId;
    try {
        const userId = req.session.user.user_id;
        orderId = req.params.orderId;
        const order = await Order.findById(orderId);

        if (!order || order.user_id !== userId) {
            return res.status(403).send('Access denied.');
        }

        if (order.payment_status === 'paid') {
            return res.redirect(`/orders/${orderId}`);
        }

        await Order.updateStatus(orderId, 'pending_payment');

        const existingPayment = await Payment.findByOrderId(orderId);
        if (!existingPayment) {
            await Payment.create({
                orderId,
                userId,
                provider: 'nets',
                amount: order.total_amount,
                status: 'pending',
                escrowStatus: 'none'
            });
        }

        const amount = Number(order.total_amount || 0).toFixed(2);
        const response = await nets.requestQrCode({ amount });
        const qrData = response?.result?.data;

        if (!isNetsSuccess({ data: qrData })) {
            await Payment.updateByOrderId(orderId, { status: 'failed' });
            await Order.updateStatus(orderId, 'cancelled');
            return res.render('netsTxnFailStatus', {
                message: 'Transaction Failed. Please try again.',
                orderId
            });
        }

        await Payment.updateByOrderId(orderId, {
            payment_reference: qrData.txn_retrieval_ref,
            provider: 'nets',
            status: 'pending'
        });

        return res.render('netsQr', {
            title: 'Scan to Pay',
            total: amount,
            qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
            txnRetrievalRef: qrData.txn_retrieval_ref,
            orderId
        });
    } catch (error) {
        console.error('NETS retry payment error:', error);
        if (orderId) {
            try {
                await Payment.updateByOrderId(orderId, { status: 'failed' });
                await Order.updateStatus(orderId, 'cancelled');
            } catch (updateError) {
                console.error('Failed to mark payment as failed:', updateError);
            }
        }
        res.render('netsTxnFailStatus', {
            message: 'Unable to restart NETS payment. Please try again.',
            orderId: orderId || null
        });
    }
};

exports.netsSuccess = async (req, res) => {
    const orderId = Number(req.query.orderId || 0);
    if (orderId) {
        try {
            await Order.updateStatus(orderId, 'pending');
        } catch (error) {
            console.error('Failed to update order status after NETS success:', error);
        }
    }
    res.render('netsTxnSuccessStatus', {
        message: 'Payment Successful! Funds are now held in escrow.',
        orderId: orderId || null
    });
};

exports.netsFail = async (req, res) => {
    const orderId = Number(req.query.orderId || 0);
    if (orderId) {
        try {
            await Order.updateStatus(orderId, 'cancelled');
        } catch (error) {
            console.error('Failed to update order status after NETS failure:', error);
        }
    }
    res.render('netsTxnFailStatus', {
        message: 'Transaction Failed. Please try again.',
        orderId: orderId || null
    });
};

exports.streamNetsStatus = async (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const txnRetrievalRef = req.params.txnRetrievalRef;
    let pollCount = 0;
    const maxPolls = 60;
    let frontendTimeoutStatus = 0;

    const interval = setInterval(async () => {
        pollCount += 1;

        try {
            const response = await nets.queryPayment({
                txnRetrievalRef,
                frontendTimeoutStatus
            });
            const result = response?.result;
            const data = result?.data || {};

            res.write(`data: ${JSON.stringify({ message: 'Checking payment status...' })}\n\n`);

            if (isNetsSuccess(result)) {
                await Payment.updateByReference(txnRetrievalRef, {
                    status: 'paid',
                    escrow_status: 'held'
                });
                res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
                clearInterval(interval);
                return res.end();
            }

            if (isNetsFailure(result, frontendTimeoutStatus)) {
                await Payment.updateByReference(txnRetrievalRef, {
                    status: 'failed',
                    escrow_status: 'none'
                });
                res.write(`data: ${JSON.stringify({ fail: true, response_code: data.response_code })}\n\n`);
                clearInterval(interval);
                return res.end();
            }
        } catch (error) {
            clearInterval(interval);
            res.write(`data: ${JSON.stringify({ fail: true, error: error.message })}\n\n`);
            return res.end();
        }

        if (pollCount >= maxPolls) {
            clearInterval(interval);
            frontendTimeoutStatus = 1;
            await Payment.updateByReference(txnRetrievalRef, {
                status: 'failed',
                escrow_status: 'none'
            });
            res.write(`data: ${JSON.stringify({ fail: true, error: 'Timeout' })}\n\n`);
            return res.end();
        }
    }, 5000);

    req.on('close', () => {
        clearInterval(interval);
    });
};

exports.createStripeCheckout = async (req, res) => {
    if (!stripe) {
        return res.redirect('/checkout?error=stripe_not_configured');
    }

    let orderId;
    try {
        const userId = req.session.user.user_id;
        const orderData = await createOrderFromCart(userId, {
            provider: 'stripe'
        });

        if (!orderData) {
            return res.redirect('/cart');
        }

        orderId = orderData.orderId;
        const amount = Number(orderData.total || 0).toFixed(2);
        const currency = orderData.currency;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: paymentService.toStripeCurrency(currency),
                        product_data: {
                            name: 'Trustmate Services Order',
                            description: 'Payment for your Trustmate order'
                        },
                        unit_amount: Math.round(Number(amount) * 100)
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/payments/stripe/cancel?orderId=${orderId}`,
            metadata: {
                orderId: String(orderId),
                userId: String(userId)
            }
        });

        await Payment.updateByOrderId(orderId, {
            payment_reference: session.id
        });

        return res.redirect(session.url);
    } catch (error) {
        console.error('Stripe checkout error:', error);
        if (error.code === 'BOOKING_DATE_UNAVAILABLE' || error.code === 'BOOKING_DATE_TAKEN') {
            req.session.errorMessage = error.message;
            return res.redirect('/cart');
        }
        if (orderId) {
            await Payment.updateByOrderId(orderId, { status: 'failed', escrow_status: 'none' });
            await Order.updateStatus(orderId, 'cancelled');
        }
        return res.redirect('/checkout?error=stripe_checkout_failed');
    }
};

exports.stripeSuccess = async (req, res) => {
    if (!stripe) {
        return res.redirect('/checkout?error=stripe_not_configured');
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
        if (session.payment_status !== 'paid') {
            return res.redirect('/payments/stripe/cancel');
        }

        const orderId = Number(session.metadata?.orderId || 0);
        if (!orderId) {
            return res.redirect('/orders');
        }

        await Payment.updateByOrderId(orderId, {
            status: 'paid',
            escrow_status: 'held',
            provider_txn_id: session.payment_intent,
            payment_reference: session.id
        });
        await Order.updateStatus(orderId, 'pending');

        return res.render('stripeSuccess', {
            orderId,
            total: (session.amount_total || 0) / 100
        });
    } catch (error) {
        console.error('Stripe success error:', error);
        return res.redirect('/checkout?error=stripe_capture_failed');
    }
};

exports.stripeCancel = async (req, res) => {
    const orderId = Number(req.query.orderId || 0);

    try {
        if (orderId) {
            await Payment.updateByOrderId(orderId, { status: 'failed', escrow_status: 'none' });
            await Order.updateStatus(orderId, 'cancelled');
        }
    } catch (error) {
        console.error('Stripe cancel error:', error);
    }

    res.render('stripeCancel', { orderId: orderId || null });
};

exports.createPayPalOrder = async (req, res) => {
    if (!paypalClient) {
        return res.status(500).json({ error: 'PayPal not configured' });
    }

    let orderId;
    try {
        const userId = req.session.user.user_id;
        const orderData = await createOrderFromCart(userId, {
            provider: 'paypal'
        });

        if (!orderData) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        orderId = orderData.orderId;
        const total = Number(orderData.total || 0).toFixed(2);
        const currency = orderData.currency;

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    amount: {
                        currency_code: currency,
                        value: total
                    }
                }
            ]
        });

        const order = await paypalClient.execute(request);

        await Payment.updateByOrderId(orderId, {
            payment_reference: order.result.id
        });

        req.session.pendingPayPalOrderId = orderId;
        res.json({ id: order.result.id });
    } catch (error) {
        console.error('PayPal order creation error:', error);
        if (error.code === 'BOOKING_DATE_UNAVAILABLE' || error.code === 'BOOKING_DATE_TAKEN') {
            req.session.errorMessage = error.message;
            return res.status(400).json({ error: error.message });
        }
        if (orderId) {
            await Payment.updateByOrderId(orderId, { status: 'failed', escrow_status: 'none' });
            await Order.updateStatus(orderId, 'cancelled');
        }
        res.status(500).json({ error: 'Failed to create PayPal order' });
    }
};

exports.capturePayPalOrder = async (req, res) => {
    if (!paypalClient) {
        return res.status(500).json({ error: 'PayPal not configured' });
    }

    const { orderID } = req.body;
    const orderId = Number(req.session.pendingPayPalOrderId || 0);
    if (!orderId) {
        return res.status(400).json({ error: 'Missing pending order' });
    }

    try {
        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});
        const capture = await paypalClient.execute(request);

        await Payment.updateByOrderId(orderId, {
            status: 'paid',
            escrow_status: 'held',
            provider_txn_id: capture.result.id,
            payment_reference: orderID
        });
        await Order.updateStatus(orderId, 'pending');

        req.session.pendingPayPalOrderId = null;
        res.json({ success: true, orderId });
    } catch (error) {
        console.error('PayPal capture error:', error);
        await Payment.updateByOrderId(orderId, { status: 'failed', escrow_status: 'none' });
        await Order.updateStatus(orderId, 'cancelled');
        res.status(500).json({ error: 'Failed to capture PayPal order' });
    }
};

const normalizeAirwallexStatus = (status) => String(status || '').trim().toUpperCase();

const isAirwallexSuccessfulStatus = (status) => {
    const normalized = normalizeAirwallexStatus(status);
    return normalized === 'SUCCEEDED' || normalized === 'REQUIRES_CAPTURE';
};

const AIRWALLEX_TERMINAL_FAILURE_STATUSES = new Set(['CANCELLED', 'FAILED', 'EXPIRED']);

const isAirwallexTerminalFailureStatus = (status) => {
    const normalized = normalizeAirwallexStatus(status);
    return AIRWALLEX_TERMINAL_FAILURE_STATUSES.has(normalized);
};

const getCustomerIpForAirwallex = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedFirst = Array.isArray(forwarded)
        ? forwarded[0]
        : String(forwarded || '').split(',')[0];

    const candidate = String(forwardedFirst || req.ip || req.socket?.remoteAddress || '').trim();
    const cleaned = candidate.replace(/^::ffff:/, '');

    if (!cleaned || cleaned === '::1' || cleaned.includes(':')) {
        return '127.0.0.1';
    }

    return cleaned;
};

exports.showAirwallexPayPage = async (req, res) => {
    const orderId = Number(req.params.orderId || 0);
    if (!orderId) {
        return res.redirect('/orders');
    }

    try {
        const userId = req.session.user.user_id;
        const order = await Order.findById(orderId);

        if (!order || Number(order.user_id) !== Number(userId)) {
            return res.status(403).send('Access denied.');
        }

        if (order.payment_status === 'paid') {
            return res.redirect(`/orders/${orderId}`);
        }

        const orderItems = await OrderItem.getByOrder(orderId);
        const payment = await Payment.findByOrderId(orderId);
        const currency = payment?.currency || 'SGD';
        const total = Number(payment?.amount || order.total_amount || 0);

        return res.render('airwallexPay', {
            order,
            orderItems,
            currency,
            total
        });
    } catch (error) {
        console.error('Airwallex pay page error:', error);
        return res.redirect('/orders');
    }
};

exports.createAirwallexPaymentIntent = async (req, res) => {
    if (!process.env.AIRWALLEX_CLIENT_ID || !process.env.AIRWALLEX_API_KEY) {
        return res.status(500).json({ error: 'Airwallex not configured' });
    }

    let orderId;
    try {
        const userId = req.session.user.user_id;
        const requestedOrderId = Number(req.body.orderId || req.query.orderId || 0);
        let orderData = null;
        let order = null;

        if (requestedOrderId) {
            order = await Order.findById(requestedOrderId);
            if (!order || Number(order.user_id) !== Number(userId)) {
                return res.status(403).json({ error: 'Access denied.' });
            }
            if (order.payment_status === 'paid') {
                return res.status(400).json({ error: 'Order already paid' });
            }
            orderId = requestedOrderId;
        } else {
            orderData = await createOrderFromCart(userId, {
                provider: 'airwallex'
            });

            if (orderData) {
                orderId = orderData.orderId;
            } else {
                const pendingOrderId = Number(req.session.pendingAirwallexOrderId || 0);
                if (pendingOrderId) {
                    order = await Order.findById(pendingOrderId);
                }

                if (!order) {
                    order = await Order.findLatestPendingPaymentByUser(userId);
                }

                if (!order) {
                    return res.status(400).json({ error: 'Cart is empty. Please add items to your cart or continue payment from My Orders.' });
                }

                if (Number(order.user_id) !== Number(userId)) {
                    return res.status(403).json({ error: 'Access denied.' });
                }

                if (order.payment_status === 'paid') {
                    return res.status(400).json({ error: 'Order already paid' });
                }

                orderId = Number(order.order_id);
            }
        }

        if (!order && orderId) {
            order = await Order.findById(orderId);
        }

        if (!order) {
            throw new Error('Unable to locate order for payment');
        }

        if (Number(order.user_id) !== Number(userId)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        await Order.updateStatus(orderId, 'pending_payment');

        let existingPayment = await Payment.findByOrderId(orderId);
        if (!existingPayment) {
            await Payment.create({
                orderId,
                userId,
                provider: 'airwallex',
                amount: order.total_amount,
                currency: 'SGD',
                status: 'pending',
                escrowStatus: 'none'
            });
            existingPayment = await Payment.findByOrderId(orderId);
        } else {
            await Payment.updateByOrderId(orderId, {
                provider: 'airwallex',
                amount: order.total_amount,
                status: 'pending',
                escrow_status: 'none'
            });
            existingPayment = await Payment.findByOrderId(orderId);
        }

        const amount = Number(existingPayment?.amount || order.total_amount || 0);
        const currency = existingPayment?.currency || 'SGD';
        const returnUrl = `${req.protocol}://${req.get('host')}/payments/airwallex/return?orderId=${orderId}`;

        const intent = await airwallex.createPaymentIntent({
            amount,
            currency,
            merchantOrderId: `order_${orderId}`,
            returnUrl
        });

        const intentId = intent?.id;
        const clientSecret = intent?.client_secret;
        if (!intentId || !clientSecret) {
            throw new Error('Invalid Airwallex PaymentIntent response');
        }

        await Payment.updateByOrderId(orderId, {
            payment_reference: intentId,
            provider: 'airwallex',
            status: 'pending',
            escrow_status: 'none'
        });

        req.session.pendingAirwallexOrderId = orderId;
        req.session.pendingAirwallexPaymentIntentId = intentId;

        return res.json({
            orderId,
            intentId,
            clientSecret,
            amount: amount.toFixed(2),
            currency
        });
    } catch (error) {
        console.error('Airwallex create intent error:', error);
        if (error.code === 'BOOKING_DATE_UNAVAILABLE' || error.code === 'BOOKING_DATE_TAKEN') {
            req.session.errorMessage = error.message;
            return res.status(400).json({ error: error.message });
        }
        if (orderId) {
            await Payment.updateByOrderId(orderId, { status: 'failed', escrow_status: 'none' });
            await Order.updateStatus(orderId, 'pending_payment');
            req.session.pendingAirwallexOrderId = orderId;
            req.session.pendingAirwallexPaymentIntentId = null;
        }
        return res.status(500).json({ error: 'Failed to create Airwallex payment' });
    }
};

exports.startAirwallexApmPayment = async (req, res) => {
    if (!process.env.AIRWALLEX_CLIENT_ID || !process.env.AIRWALLEX_API_KEY) {
        req.session.errorMessage = 'Airwallex not configured.';
        return res.redirect('/checkout');
    }

    const rawMethod = String(req.body.method || '').trim().toLowerCase();
    const normalizedMethod = rawMethod === 'alipay' ? 'alipaycn'
        : rawMethod === 'wechat' ? 'wechatpay'
            : rawMethod;

    const methodConfig = normalizedMethod === 'wechatpay'
        ? { label: 'WeChat Pay', type: 'wechatpay' }
        : normalizedMethod === 'alipaycn'
            ? { label: 'Alipay', type: 'alipaycn' }
            : null;

    if (!methodConfig) {
        req.session.errorMessage = 'Unsupported payment method.';
        return res.redirect('/checkout');
    }

    let orderId;
    try {
        const userId = req.session.user.user_id;
        const requestedOrderId = Number(req.body.orderId || req.query.orderId || 0);
        let orderData = null;
        let order = null;

        if (requestedOrderId) {
            order = await Order.findById(requestedOrderId);
            if (!order || Number(order.user_id) !== Number(userId)) {
                return res.status(403).send('Access denied.');
            }
            if (order.payment_status === 'paid') {
                return res.redirect(`/orders/${requestedOrderId}`);
            }
            orderId = requestedOrderId;
        } else {
            orderData = await createOrderFromCart(userId, { provider: 'airwallex' });
            if (orderData) {
                orderId = orderData.orderId;
            } else {
                const pendingOrderId = Number(req.session.pendingAirwallexOrderId || 0);
                if (pendingOrderId) {
                    order = await Order.findById(pendingOrderId);
                }

                if (!order) {
                    order = await Order.findLatestPendingPaymentByUser(userId);
                }

                if (!order) {
                    req.session.errorMessage = 'Cart is empty. Please add items to your cart or continue payment from My Orders.';
                    return res.redirect('/cart');
                }

                orderId = Number(order.order_id);
            }
        }

        if (!order && orderId) {
            order = await Order.findById(orderId);
        }

        if (!order) {
            throw new Error('Unable to locate order for payment');
        }

        if (Number(order.user_id) !== Number(userId)) {
            return res.status(403).send('Access denied.');
        }

        if (order.payment_status === 'paid') {
            return res.redirect(`/orders/${orderId}`);
        }

        await Order.updateStatus(orderId, 'pending_payment');

        let existingPayment = await Payment.findByOrderId(orderId);
        if (!existingPayment) {
            await Payment.create({
                orderId,
                userId,
                provider: 'airwallex',
                amount: order.total_amount,
                currency: 'SGD',
                status: 'pending',
                escrowStatus: 'none'
            });
            existingPayment = await Payment.findByOrderId(orderId);
        } else {
            await Payment.updateByOrderId(orderId, {
                provider: 'airwallex',
                amount: order.total_amount,
                status: 'pending',
                escrow_status: 'none'
            });
            existingPayment = await Payment.findByOrderId(orderId);
        }

        const amount = Number(existingPayment?.amount || order.total_amount || 0);
        const currency = existingPayment?.currency || 'SGD';
        const returnUrl = `${req.protocol}://${req.get('host')}/payments/airwallex/return?orderId=${orderId}`;

        const intent = await airwallex.createPaymentIntent({
            amount,
            currency,
            merchantOrderId: `order_${orderId}`,
            returnUrl
        });

        const intentId = intent?.id;
        const clientSecret = intent?.client_secret;
        if (!intentId || !clientSecret) {
            throw new Error('Invalid Airwallex PaymentIntent response');
        }

        await Payment.updateByOrderId(orderId, {
            payment_reference: intentId,
            provider: 'airwallex',
            status: 'pending',
            escrow_status: 'none'
        });

        req.session.pendingAirwallexOrderId = orderId;
        req.session.pendingAirwallexPaymentIntentId = intentId;

        const confirm = await airwallex.confirmPaymentIntent(intentId, {
            paymentMethod: {
                type: methodConfig.type,
                [methodConfig.type]: {
                    flow: 'qrcode'
                }
            },
            customerIp: getCustomerIpForAirwallex(req)
        });

        const status = confirm?.status;
        if (isAirwallexSuccessfulStatus(status)) {
            await Payment.updateByOrderId(orderId, {
                status: 'paid',
                escrow_status: 'held',
                provider_txn_id: confirm?.latest_transaction?.id || intentId,
                payment_reference: intentId
            });
            await Order.updateStatus(orderId, 'pending');

            req.session.pendingAirwallexOrderId = null;
            req.session.pendingAirwallexPaymentIntentId = null;

            return res.redirect(`/orders/${orderId}`);
        }

        const nextAction = confirm?.next_action;
        const nextType = String(nextAction?.type || '').toLowerCase();

        if (nextType === 'redirect' && nextAction?.url) {
            return res.redirect(nextAction.url);
        }

        if (nextType !== 'render_qrcode') {
            throw new Error('Unsupported Airwallex next_action type');
        }

        const qrText = nextAction?.qrcode;
        if (!qrText) {
            throw new Error('Airwallex did not return a QR code');
        }

        const qrCodeUrl = await QRCode.toDataURL(qrText, { width: 260, margin: 1 });

        return res.render('airwallexQr', {
            orderId,
            total: amount.toFixed(2),
            currency,
            qrCodeUrl,
            intentId,
            methodLabel: methodConfig.label,
            fallbackUrl: nextAction?.url || nextAction?.qrcode_url || null
        });
    } catch (error) {
        console.error('Airwallex APM start error:', error);
        if (error.code === 'BOOKING_DATE_UNAVAILABLE' || error.code === 'BOOKING_DATE_TAKEN') {
            req.session.errorMessage = error.message;
            return res.redirect('/cart');
        }

        if (orderId) {
            try {
                await Payment.updateByOrderId(orderId, { status: 'failed', escrow_status: 'none' });
                await Order.updateStatus(orderId, 'pending_payment');
                req.session.pendingAirwallexOrderId = orderId;
                req.session.pendingAirwallexPaymentIntentId = null;
            } catch (updateError) {
                console.error('Failed to mark Airwallex payment as failed:', updateError);
            }

            req.session.errorMessage = 'Airwallex payment could not be started. Please try again.';
            return res.redirect(`/payments/airwallex/pay/${orderId}`);
        }

        req.session.errorMessage = 'Airwallex payment could not be started. Please try again.';
        return res.redirect('/checkout');
    }
};

exports.finalizeAirwallexPayment = async (req, res) => {
    if (!process.env.AIRWALLEX_CLIENT_ID || !process.env.AIRWALLEX_API_KEY) {
        return res.status(500).json({ error: 'Airwallex not configured' });
    }

    const orderId = Number(req.session.pendingAirwallexOrderId || 0);
    const intentId = String(req.body.intentId || '').trim();

    if (!orderId || !intentId) {
        return res.status(400).json({ error: 'Missing payment details' });
    }

    if (req.session.pendingAirwallexPaymentIntentId && req.session.pendingAirwallexPaymentIntentId !== intentId) {
        return res.status(400).json({ error: 'Mismatched payment intent' });
    }

    try {
        const intent = await airwallex.getPaymentIntent(intentId);
        const status = intent?.status;

        if (isAirwallexSuccessfulStatus(status)) {
            await Payment.updateByOrderId(orderId, {
                status: 'paid',
                escrow_status: 'held',
                provider_txn_id: intent?.latest_transaction?.id || intentId,
                payment_reference: intentId
            });
            await Order.updateStatus(orderId, 'pending');

            req.session.pendingAirwallexOrderId = null;
            req.session.pendingAirwallexPaymentIntentId = null;

            return res.json({ success: true, orderId });
        }

        if (isAirwallexTerminalFailureStatus(status)) {
            await Payment.updateByOrderId(orderId, {
                status: 'failed',
                escrow_status: 'none',
                provider_txn_id: intent?.latest_transaction?.id || intentId,
                payment_reference: intentId
            });
            await Order.updateStatus(orderId, 'pending_payment');

            req.session.pendingAirwallexOrderId = orderId;
            req.session.pendingAirwallexPaymentIntentId = null;

            return res.status(400).json({
                error: 'Payment failed',
                status
            });
        }

        await Payment.updateByOrderId(orderId, {
            status: 'pending',
            escrow_status: 'none',
            provider_txn_id: intent?.latest_transaction?.id || intentId,
            payment_reference: intentId
        });
        await Order.updateStatus(orderId, 'pending_payment');

        req.session.pendingAirwallexOrderId = orderId;
        req.session.pendingAirwallexPaymentIntentId = intentId;

        return res.status(202).json({
            pending: true,
            status,
            message: 'Awaiting payment confirmation'
        });
    } catch (error) {
        console.error('Airwallex finalize error:', error);
        return res.status(500).json({ error: 'Failed to verify Airwallex payment' });
    }
};

exports.airwallexReturn = async (req, res) => {
    if (!process.env.AIRWALLEX_CLIENT_ID || !process.env.AIRWALLEX_API_KEY) {
        return res.redirect('/checkout?error=airwallex_not_configured');
    }

    const orderId = Number(req.query.orderId || 0);
    if (!orderId) {
        return res.redirect('/orders');
    }

    try {
        const payment = await Payment.findByOrderId(orderId);
        if (!payment || Number(payment.user_id) !== Number(req.session.user?.user_id)) {
            return res.redirect('/orders');
        }

        const intentId = payment.payment_reference;
        if (!intentId) {
            return res.redirect(`/orders/${orderId}`);
        }

        const intent = await airwallex.getPaymentIntent(intentId);
        const status = intent?.status;

        if (isAirwallexSuccessfulStatus(status)) {
            await Payment.updateByOrderId(orderId, {
                status: 'paid',
                escrow_status: 'held',
                provider_txn_id: intent?.latest_transaction?.id || intentId,
                payment_reference: intentId
            });
            await Order.updateStatus(orderId, 'pending');
            req.session.successMessage = 'Payment Successful! Funds are now held in escrow.';
            return res.redirect(`/orders/${orderId}`);
        }

        if (isAirwallexTerminalFailureStatus(status)) {
            await Payment.updateByOrderId(orderId, { status: 'failed', escrow_status: 'none' });
            await Order.updateStatus(orderId, 'pending_payment');
            req.session.errorMessage = 'Airwallex payment failed. Please try again.';
            return res.redirect(`/orders/${orderId}`);
        }

        await Payment.updateByOrderId(orderId, {
            status: 'pending',
            escrow_status: 'none',
            provider_txn_id: intent?.latest_transaction?.id || intentId,
            payment_reference: intentId
        });
        await Order.updateStatus(orderId, 'pending_payment');

        req.session.pendingAirwallexOrderId = orderId;
        req.session.pendingAirwallexPaymentIntentId = intentId;
        req.session.errorMessage = `Airwallex payment is still pending (${normalizeAirwallexStatus(status) || 'PENDING'}). Please check again shortly.`;
        return res.redirect(`/orders/${orderId}`);
    } catch (error) {
        console.error('Airwallex return error:', error);
        req.session.errorMessage = 'Airwallex payment failed. Please try again.';
        return res.redirect(`/orders/${orderId}`);
    }
};
