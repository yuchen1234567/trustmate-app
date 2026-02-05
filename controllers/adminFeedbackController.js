const db = require("../db");

exports.list = async (req, res) => {

  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Access denied. Admin only.");
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        f.id,
        f.user_id,
        u.username,
        f.message,
        f.created_at
       FROM feedback f
       LEFT JOIN users u ON f.user_id = u.user_id
       ORDER BY f.created_at DESC
    `);


    res.render("adminFeedback", {
      user: req.session.user,
      feedbacks: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load feedback");
  }
};


