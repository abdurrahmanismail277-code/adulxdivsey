const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const contactTable = process.env.CONTACT_TABLE || 'contacts';

app.use(cors());
app.use(express.json());

const hasSupabaseConfig = Boolean(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabase = hasSupabaseConfig
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

app.get(['/', '/api'], (req, res) => {
  res.json({
    success: true,
    message: 'API is working'
  });
});

app.post(['/contact', '/api/contact'], async (req, res) => {
  try {
    const { name, email, phone, message, course, billing, amount } = req.body;

    if (!name || !email || (!(message || phone))) {
      return res.status(400).json({
        success: false,
        error: 'Required fields are missing. Provide name, email, and either message or phone.'
      });
    }

    const contact = {
      name,
      email,
      phone,
      course,
      billing,
      amount,
      message
    };

    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.'
      });
    }

    const { data, error } = await supabase
      .from(contactTable)
      .insert([contact]);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Supabase insert failed'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message saved successfully',
      data
    });
  } catch (err) {
    console.error('Contact route error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Server error'
    });
  }
});

if (require.main === module) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

module.exports = app;
