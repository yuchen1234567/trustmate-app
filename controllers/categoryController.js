const Category = require('../models/category');

// Get all categories
exports.index = async (req, res) => {
    try {
        const categories = await Category.getAll();
        res.render('categories', { categories });
    } catch (error) {
        console.error(error);
        res.render('categories', { categories: [] });
    }
};

// Show create category form
exports.showCreate = (req, res) => {
    res.render('createCategory', { error: null });
};

// Create category
exports.create = async (req, res) => {
    try {
        const { name, description, icon } = req.body;
        await Category.create(name, description, icon);
        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.render('createCategory', { error: 'Failed to create category' });
    }
};

// Show edit category form
exports.showEdit = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        res.render('editCategory', { category, error: null });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/categories');
    }
};

// Update category
exports.update = async (req, res) => {
    try {
        const { name, description, icon } = req.body;
        await Category.update(req.params.id, name, description, icon);
        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/categories');
    }
};

// Delete category
exports.delete = async (req, res) => {
    try {
        await Category.delete(req.params.id);
        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/categories');
    }
};
