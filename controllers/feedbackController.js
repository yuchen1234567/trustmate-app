
const db = require("../db");
const Order = require("../models/order");

exports.submit = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.session.user.user_id || req.session.user.id;

    const orders = await Order.getByUser(userId);
    const hasEligibleOrder = orders.some(
      (order) => order.status === "completed" || order.payment_status === "paid"
    );
    if (!hasEligibleOrder) {
      return res.status(403).render("userfeedback", {
        user: req.session.user,
        error: "You can only submit feedback after a completed or paid order."
      });
    }

    await db.query(
      "INSERT INTO feedback (user_id, message) VALUES (?, ?)",
      [userId, message]
    );

    return res.redirect("/userfeedback/success");
  } catch (err) {
    console.error("Submit feedback error:", err);
    return res.status(500).render("userfeedback", {
      user: req.session.user,
      error: "Failed to submit feedback. Please try again."
    });
  }
};
