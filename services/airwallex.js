const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://api-demo.airwallex.com';
const DEFAULT_TIMEOUT_MS = 15000;
const TOKEN_SAFETY_WINDOW_MS = 60 * 1000;

const getConfig = () => {
    const clientId = process.env.AIRWALLEX_CLIENT_ID;
    const apiKey = process.env.AIRWALLEX_API_KEY;
    const baseUrl = process.env.AIRWALLEX_BASE_URL || DEFAULT_BASE_URL;
    const loginAs = process.env.AIRWALLEX_LOGIN_AS;

    if (!clientId || !apiKey) {
        throw new Error('Airwallex client ID or API key is missing');
    }

    return { clientId, apiKey, baseUrl, loginAs };
};

let cachedToken = null;
let cachedTokenExpiresAt = 0;

const fetchJson = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const text = await response.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch (error) {
                data = { raw: text };
            }
        }

        if (!response.ok) {
            const detail = data?.message || data?.error || data?.raw || response.statusText;
            const error = new Error(`Airwallex API error (${response.status}): ${detail}`);
            error.status = response.status;
            error.detail = data;
            throw error;
        }

        return data;
    } finally {
        clearTimeout(timeout);
    }
};

const login = async () => {
    const { clientId, apiKey, baseUrl, loginAs } = getConfig();

    const headers = {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-key': apiKey
    };

    if (loginAs) {
        headers['x-login-as'] = loginAs;
    }

    const data = await fetchJson(`${baseUrl}/api/v1/authentication/login`, {
        method: 'POST',
        headers
    });

    const token = data?.token;
    const expiresAtValue = data?.expires_at;
    const expiresAt = expiresAtValue ? Date.parse(expiresAtValue) : null;

    if (!token) {
        throw new Error('Airwallex authentication failed: missing token');
    }

    cachedToken = token;
    cachedTokenExpiresAt = Number.isFinite(expiresAt) ? expiresAt : Date.now() + (15 * 60 * 1000);

    return token;
};

const getAccessToken = async () => {
    if (cachedToken && cachedTokenExpiresAt - TOKEN_SAFETY_WINDOW_MS > Date.now()) {
        return cachedToken;
    }

    return login();
};

const apiRequest = async (path, { method = 'GET', body } = {}) => {
    const makeRequest = async () => {
        const { clientId, baseUrl } = getConfig();
        const token = await getAccessToken();

        const headers = {
            Authorization: `Bearer ${token}`,
            'x-client-id': clientId
        };

        const options = { method, headers };
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        return fetchJson(`${baseUrl}${path}`, options);
    };

    try {
        return await makeRequest();
    } catch (error) {
        if (error?.status === 401) {
            cachedToken = null;
            cachedTokenExpiresAt = 0;
            return makeRequest();
        }
        throw error;
    }
};

const createPaymentIntent = async ({
    requestId,
    amount,
    currency,
    merchantOrderId,
    returnUrl
} = {}) => {
    const resolvedRequestId = requestId || crypto.randomUUID();
    const resolvedAmount = Number(amount);
    if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
        throw new Error('Invalid payment amount');
    }

    return apiRequest('/api/v1/pa/payment_intents/create', {
        method: 'POST',
        body: {
            request_id: resolvedRequestId,
            amount: Number(resolvedAmount.toFixed(2)),
            currency,
            merchant_order_id: merchantOrderId,
            return_url: returnUrl
        }
    });
};

const getPaymentIntent = async (paymentIntentId) => {
    if (!paymentIntentId) {
        throw new Error('Missing payment intent id');
    }
    return apiRequest(`/api/v1/pa/payment_intents/${encodeURIComponent(paymentIntentId)}`);
};

const confirmPaymentIntent = async (
    paymentIntentId,
    { requestId, paymentMethod, customerIp, returnUrl } = {}
) => {
    if (!paymentIntentId) {
        throw new Error('Missing payment intent id');
    }

    const resolvedRequestId = requestId || crypto.randomUUID();
    const body = { request_id: resolvedRequestId };

    if (paymentMethod) {
        body.payment_method = paymentMethod;
    }

    if (customerIp) {
        body.customer_ip = customerIp;
    }

    if (returnUrl) {
        body.return_url = returnUrl;
    }

    return apiRequest(`/api/v1/pa/payment_intents/${encodeURIComponent(paymentIntentId)}/confirm`, {
        method: 'POST',
        body
    });
};

module.exports = {
    createPaymentIntent,
    getPaymentIntent,
    confirmPaymentIntent
};
