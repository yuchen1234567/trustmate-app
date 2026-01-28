const Cart = require('../models/cart');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const Payment = require('../models/payment');
const nets = require('../services/nets');

const createOrderFromCart = async (userId) => {
    const cartItems = await Cart.getByUser(userId);
    if (cartItems.length === 0) {
        return null;
    }

    const total = await Cart.getTotal(userId);
    const orderId = await Order.create(userId, total);

    for (const item of cartItems) {
        await OrderItem.create(orderId, item.service_id, item.quantity, item.price);
    }

    await Payment.create({
        orderId,
        userId,
        provider: 'nets',
        amount: total,
        status: 'pending',
        escrowStatus: 'none'
    });

    await Cart.clearUserCart(userId);
    return { orderId, total };
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
    res.render('netsTxnSuccessStatus', {
        message: 'Payment Successful! Funds are now held in escrow.',
        orderId: req.query.orderId || null
    });
};

exports.netsFail = async (req, res) => {
    res.render('netsTxnFailStatus', {
        message: 'Transaction Failed. Please try again.',
        orderId: req.query.orderId || null
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
