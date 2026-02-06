const Cart = require('../models/cart');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const Payment = require('../models/payment');
const Fraud = require('../models/fraud');
const nets = require('../services/nets');
const paymentService = require('../services/paymentService');

const HIGH_VALUE_THRESHOLD = 2000;

const flagHighValueOrder = async (userId, orderId, total) => {
    const amount = Number(total || 0);
    if (amount <= HIGH_VALUE_THRESHOLD) {
        return;
    }

    try {
        await Fraud.createAlert(
            userId,
            'High-value transaction',
            `Order #${orderId} total ${amount.toFixed(2)} exceeds ${HIGH_VALUE_THRESHOLD}`
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
    const orderId = await Order.create(userId, total);
    await Order.updateStatus(orderId, 'pending_payment');

    for (const item of cartItems) {
        await OrderItem.create(orderId, item.service_id, item.quantity, item.price);
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
            provider: 'stripe',
            currency: req.body.currency || req.query.currency
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
            provider: 'paypal',
            currency: req.body.currency || req.query.currency
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
