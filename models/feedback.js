
const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/userfeedback", (req, res) => {
  console.log("✅ POST /userfeedback hit");

  // ... insert success callback 
  return res.redirect("/userfeedback/success");
});


// GET feedback page
router.get("/userfeedback", (req, res) => {
  res.render("userfeedback", { user: req.session.user });
});

// POST submit feedback
router.post("/userfeedback", async (req, res) => {
  console.log("✅ POST /userfeedback hit");

  if (!req.session.user) return res.redirect("/login");

  const { message } = req.body;
  const userId = req.session.user.user_id || req.session.user.id;

  try {
    await db.query(
      "INSERT INTO feedback (user_id, message) VALUES (?, ?)",
      [userId, message]
    );

    console.log("✅ feedback inserted, redirecting...");
    return res.redirect("/userfeedback/success");
  } catch (err) {
    console.error("❌ Insert feedback error:", err);
    return res.status(500).send("DB error");
  }
});


router.get("/userfeedback/success", (req, res) => {
  res.render("feedbackSuccess", { user: req.session.user });
});

module.exports = router;
