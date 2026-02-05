const express = require("express");
const router = express.Router();

const sellerCatalogController = require("../controllers/sellerCatalogController");

// Catalog
router.get("/services/catalog", sellerCatalogController.catalog);
router.post("/services/catalog/add", sellerCatalogController.addFromCatalog);

module.exports = router;
