const db = require("../db");

function normalizeDates(start, end) {
  const now = new Date();
  const endDate = end ? new Date(end) : now;
  const startDate = start ? new Date(start) : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const toMysql = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  return { startMysql: toMysql(startDate), endMysql: toMysql(endDate) };
}

exports.salesReport = async (req, res) => {
  try {
    const { start, end } = req.query;
    const { startMysql, endMysql } = normalizeDates(start, end);

    // =========================
    // 1) Overall Summary
    // =========================
    const [rows] = await db.query(
      `
      SELECT
        COUNT(*) AS totalOrders,
        COALESCE(SUM(total_amount), 0) AS totalRevenue
      FROM orders
      WHERE status = 'completed'
        AND created_at BETWEEN ? AND ?
      `,
      [startMysql, endMysql]
    );

    const totalOrders = Number(rows[0]?.totalOrders) || 0;
    const totalRevenue = Number(rows[0]?.totalRevenue) || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // =========================
    // 2) Seller Performance
    // order_items: order_id, service_id, quantity, price
    // sellers via services.seller_id
    // =========================
    const [sellerRows] = await db.query(
      `
      SELECT
        sel.seller_id,
        sel.business_name,
        COUNT(DISTINCT o.order_id) AS ordersCount,
        COALESCE(SUM(oi.quantity), 0) AS servicesSold,
        COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN services s ON oi.service_id = s.service_id
      JOIN sellers sel ON s.seller_id = sel.seller_id
      WHERE o.status = 'completed'
        AND o.created_at BETWEEN ? AND ?
      GROUP BY sel.seller_id, sel.business_name
      ORDER BY revenue DESC
      `,
      [startMysql, endMysql]
    );

    // =========================
    // 3) Top Services
    // =========================
    const [serviceRows] = await db.query(
      `
      SELECT
        s.service_id,
        s.title,
        COALESCE(SUM(oi.quantity), 0) AS qtySold,
        COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN services s ON oi.service_id = s.service_id
      WHERE o.status = 'completed'
        AND o.created_at BETWEEN ? AND ?
      GROUP BY s.service_id, s.title
      ORDER BY revenue DESC
      LIMIT 10
      `,
      [startMysql, endMysql]
    );

    // Debug（可留可删）
    console.log("DEBUG totalOrders =", totalOrders);
    console.log("DEBUG totalRevenue =", totalRevenue);
    console.log("DEBUG avgOrderValue =", avgOrderValue);
    console.log("DEBUG sellerRows =", sellerRows.length);
    console.log("DEBUG serviceRows =", serviceRows.length);

    // =========================
    // Render
    // =========================
    res.render("salesReport", {
      filters: { start: start || "", end: end || "" },
      stats: { totalOrders, totalRevenue, avgOrderValue },
      sellerRows,
      serviceRows,
    });
  } catch (err) {
    console.error("salesReport error:", err);
    res.status(500).send("Failed to load sales report");
  }
};
