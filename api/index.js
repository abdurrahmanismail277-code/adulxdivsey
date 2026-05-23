const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Root API route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API is working"
  });
});

// Contact route
app.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const { data, error } = await supabase
      .from(process.env.CONTACT_TABLE)
      .insert([
        {
          name,
          email,
          message
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: "Message saved successfully",
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// REQUIRED FOR VERCEL
module.exports = app;
