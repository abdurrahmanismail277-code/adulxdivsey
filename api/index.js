const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS if you need it for frontend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Log every request - check this in Vercel Runtime Logs
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// GET /api
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API route is working',
    time: new Date().toISOString()
  });
});

// POST /api/contact
app.post('/contact', async (req, res) => {
  try {
    console.log('Contact form body:', req.body);
    
    // Replace this with your actual logic
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Do your Supabase insert or whatever here
    // const { data, error } = await supabase.from('contacts').insert({...})

    res.json({ 
      success: true, 
      message: 'Contact received',
      data: { name, email }
    });

  } catch (err) {
    console.error('Error in /contact:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: `Route ${req.method} ${req.url} not found` 
  });
});

module.exports = app;
