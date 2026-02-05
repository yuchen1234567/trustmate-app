const https = require('https');

const getConfig = () => {
    const apiKey = process.env.NETS_API_KEY || process.env.API_KEY;
    const projectId = process.env.NETS_PROJECT_ID || process.env.PROJECT_ID;
    const baseUrl = process.env.NETS_BASE_URL || 'https://sandbox.nets.openapipaas.com';

    if (!apiKey || !projectId) {
        throw new Error('NETS API key or project ID is missing');
    }

    return { apiKey, projectId, baseUrl };
};

const postJson = (url, body, headers) => new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...headers
        }
    }, (response) => {
        let data = '';
        response.on('data', (chunk) => {
            data += chunk;
        });
        response.on('end', () => {
            try {
                const parsed = JSON.parse(data || '{}');
                resolve(parsed);
            } catch (error) {
                reject(new Error('Invalid JSON response from NETS'));
            }
        });
    });

    request.on('error', reject);
    request.write(payload);
    request.end();
});

const requestQrCode = async ({ amount, txnId }) => {
    const { apiKey, projectId, baseUrl } = getConfig();
    const resolvedTxnId = txnId
        || process.env.NETS_TXN_ID
        || 'sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b';
    const body = {
        txn_id: resolvedTxnId,
        amt_in_dollars: amount,
        notify_mobile: 0
    };

    return postJson(
        `${baseUrl}/api/v1/common/payments/nets-qr/request`,
        body,
        {
            'api-key': apiKey,
            'project-id': projectId
        }
    );
};

const queryPayment = async ({ txnRetrievalRef, frontendTimeoutStatus = 0 }) => {
    const { apiKey, projectId, baseUrl } = getConfig();
    const body = {
        txn_retrieval_ref: txnRetrievalRef,
        frontend_timeout_status: frontendTimeoutStatus
    };

    return postJson(
        `${baseUrl}/api/v1/common/payments/nets-qr/query`,
        body,
        {
            'api-key': apiKey,
            'project-id': projectId
        }
    );
};

module.exports = {
    requestQrCode,
    queryPayment
};
