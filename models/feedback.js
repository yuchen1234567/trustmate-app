// routes/feedback.js
const express = require("express");
const router = express.Router();
const db = require("../db");

app.get("/userfeedback", (req, res) => {
  res.render("userfeedback", { user: req.session.user });
});

app.post("/userfeedback", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const { message } = req.body;
  const userId = req.session.user.id;

  const sql = "INSERT INTO feedback (user_id, message) VALUES (?, ?)";
  db.query(sql, [userId, message], (err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

module.exports = router;