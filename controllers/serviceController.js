const Service = require('../models/service');
const Category = require('../models/category');
const Review = require('../models/review');
const Seller = require('../models/seller');
const SellerAvailability = require('../models/sellerAvailability');

// Show all services (homepage)
exports.index = async (req, res) => {
    try {
        const services = await Service.getAll();
        const categories = await Category.getAll();
        res.render('index', { services, categories });
    } catch (error) {
        console.error(error);
        res.render('index', { services: [], categories: [], error: 'Failed to load services' });
    }
};

// Show service details
exports.show = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        const reviews = await Review.getByService(req.params.id);
        const avgRating = await Review.getAverageRating(req.params.id);
        
        if (!service) {
            return res.status(404).send('Service not found');
        }

        let canReply = false;
        if (req.session.user && req.session.user.role === 'seller') {
            const seller = await Seller.findByUserId(req.session.user.user_id);
            if (seller && service.seller_id === seller.seller_id) {
                canReply = true;
            }
        }

        const availability = await SellerAvailability.getBySeller(service.seller_id);
        const toDateKey = (value) => {
            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) {
                return null;
            }
            return date.toISOString().slice(0, 10);
        };
        const availableDates = availability
            .filter(item => item.status === 'available')
            .map(item => toDateKey(item.availability_date))
            .filter(Boolean);
        const unavailableDates = availability
            .filter(item => item.status === 'unavailable')
            .map(item => toDateKey(item.availability_date))
            .filter(Boolean);

        res.render('serviceDetail', {
            service,
            reviews,
            avgRating,
            canReply,
            availableDates,
            unavailableDates
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading service');
    }
};

// Search services
exports.search = async (req, res) => {
    try {
        const { q, category } = req.query;
        let services;

        if (category) {
            services = await Service.getByCategory(category);
        } else if (q) {
            services = await Service.search(q);
        } else {
            services = await Service.getAll();
        }

        const categories = await Category.getAll();
        res.render('services', { services, categories, searchTerm: q || '', selectedCategory: category || '' });
    } catch (error) {
        console.error(error);
        res.render('services', { services: [], categories: [], searchTerm: '', selectedCategory: '' });
    }
};

// Show create service form
exports.showCreate = async (req, res) => {
    try {
        const categories = await Category.getAll();
        res.render('createService', { categories, error: null });
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
};

// Create service
exports.create = async (req, res) => {
    try {
        const { title, description, price, category_id } = req.body;
        let sellerId = req.session.sellerId;
        if (!sellerId) {
            const seller = await Seller.findByUserId(req.session.user.user_id);
            if (!seller) {
                return res.status(403).send('You must be a seller to create services');
            }
            sellerId = seller.seller_id;
            req.session.sellerId = sellerId;
        }

        const image = req.body.image || '/images/default-service.png';
        await Service.create(sellerId, title, description, price, category_id, image);
        
        res.redirect('/seller/services');
    } catch (error) {
        console.error(error);
        const categories = await Category.getAll();
        res.render('createService', { categories, error: 'Failed to create service' });
    }
};

// Show edit service form
exports.showEdit = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        const categories = await Category.getAll();
        
        if (!service) {
            return res.status(404).send('Service not found');
        }

        // Verify ownership (allow admin to edit any service)
        if (req.session.user.role !== 'admin') {
            const Seller = require('../models/seller');
            const seller = await Seller.findByUserId(req.session.user.user_id);
            
            if (!seller || service.seller_id !== seller.seller_id) {
                return res.status(403).send('Access denied. You can only edit your own services.');
            }
        }

        res.render('editService', { service, categories, error: null });
    } catch (error) {
        console.error(error);
        res.redirect('/seller/services');
    }
};

// Update service
exports.update = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        
        if (!service) {
            return res.status(404).send('Service not found');
        }

        // Verify ownership (allow admin to update any service)
        if (req.session.user.role !== 'admin') {
            const Seller = require('../models/seller');
            const seller = await Seller.findByUserId(req.session.user.user_id);
            
            if (!seller || service.seller_id !== seller.seller_id) {
                return res.status(403).send('Access denied. You can only update your own services.');
            }
        }

        const { title, description, price, category_id, image } = req.body;
        await Service.update(req.params.id, title, description, price, category_id, image);
        res.redirect('/seller/services');
    } catch (error) {
        console.error(error);
        res.redirect('/seller/services');
    }
};

// Delete service
exports.delete = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        
        if (!service) {
            return res.status(404).send('Service not found');
        }

        // Verify ownership (allow admin to delete any service)
        if (req.session.user.role !== 'admin') {
            const Seller = require('../models/seller');
            const seller = await Seller.findByUserId(req.session.user.user_id);
            
            if (!seller || service.seller_id !== seller.seller_id) {
                return res.status(403).send('Access denied. You can only delete your own services.');
            }
        }

        await Service.delete(req.params.id);
        res.redirect('/seller/services');
    } catch (error) {
        console.error(error);
        res.redirect('/seller/services');
    }
};
