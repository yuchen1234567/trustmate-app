
const express = require("express");
const router = express.Router();
const adminReportsController = require("../controllers/adminReportsController");


function ensureAdmin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");


  const isAdmin = req.session.user.role === "admin" || req.session.user.is_admin === 1;
  if (!isAdmin) return res.status(403).send("Forbidden: Admin only");
  next();
}

router.get("/reports/sales", ensureAdmin, adminReportsController.salesReport);

module.exports = router;
