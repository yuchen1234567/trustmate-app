
const db = require("../db");

exports.submit = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.session.user.user_id || req.session.user.id;

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
