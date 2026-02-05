// controllers/sellerCatalogController.js
const db = require("../db");
const Seller = require("../models/seller");


async function getSellerId(req) {
  if (req.session.sellerId) return req.session.sellerId;

  const userId = req.session.user?.user_id;
  if (!userId) return null;

  const seller = await Seller.findByUserId(userId);
  return seller?.seller_id || null;
}

// ✅ GET /seller/services/catalog
exports.catalog = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const sellerId = await getSellerId(req);

    if (!sellerId) return res.redirect("/seller/register");

    const like = `%${q}%`;

    const [rows] = await db.query(
      `
      SELECT 
        s.service_id,
        s.title,
        s.price,
        s.description,
        CASE WHEN ss.seller_id IS NULL THEN 0 ELSE 1 END AS alreadyAdded
      FROM services s
      LEFT JOIN seller_services ss 
        ON ss.service_id = s.service_id
       AND ss.seller_id = ?
      WHERE (? = '' OR s.title LIKE ?)
      ORDER BY s.service_id DESC
      LIMIT 100
      `,
      [sellerId, q, like]
    );

    return res.render("sellerServiceCatalog", {
      user: req.session.user,
      q,
      services: rows
    });
  } catch (err) {
    console.error("catalog error:", err);
    return res.status(500).send("Failed to load catalog");
  }
};

// ✅ POST /seller/services/catalog/add
exports.addFromCatalog = async (req, res) => {
  try {
    const sellerId = await getSellerId(req);
    if (!sellerId) return res.redirect("/seller/register");

    const serviceId = Number(req.body.service_id);
    if (!serviceId) return res.status(400).send("Missing service_id");

    await db.query(
      `
      INSERT INTO seller_services (seller_id, service_id, status)
      VALUES (?, ?, 'active')
      ON DUPLICATE KEY UPDATE status = 'active'
      `,
      [sellerId, serviceId]
    );

    return res.redirect("/seller/dashboard");
  } catch (err) {
    console.error("addFromCatalog error:", err);
    return res.status(500).send("Failed to add service");
  }
};
