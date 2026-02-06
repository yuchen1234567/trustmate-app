const SUPPORTED_CURRENCIES = new Set(['SGD']);

const normalizeCurrency = (value) => {
    if (!value) {
        return null;
    }
    return String(value).trim().toUpperCase();
};

const resolveCurrency = (value, fallback = 'SGD') => {
    const normalized = normalizeCurrency(value) || normalizeCurrency(fallback) || 'SGD';
    if (!SUPPORTED_CURRENCIES.has(normalized)) {
        const error = new Error(`Unsupported currency: ${normalized}`);
        error.code = 'UNSUPPORTED_CURRENCY';
        throw error;
    }
    return normalized;
};

const toStripeCurrency = (value) => resolveCurrency(value).toLowerCase();

module.exports = {
    resolveCurrency,
    toStripeCurrency,
    SUPPORTED_CURRENCIES
};
