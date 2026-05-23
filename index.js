const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);
const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseKey)
  : null;
const contactTable = process.env.CONTACT_TABLE || 'contacts';
const localContactsFile = path.join(__dirname, 'contacts.json');
const missingSupabaseVars = [
  supabaseUrl ? null : 'SUPABASE_URL',
  supabaseKey ? null : 'SUPABASE_SERVICE_ROLE_KEY'
].filter(Boolean);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.get('/api/health', (req, res) =>
  res.json({
    ok: true,
    supabaseConfigured: hasSupabaseConfig,
    contactTable,
    missingSupabaseVars
  })
);

// This backend folder is intended to expose API routes only.
// The frontend should be deployed separately or served from a dedicated public folder.

async function saveContactLocally(contact) {
  let contacts = [];

  try {
    const file = await fs.readFile(localContactsFile, 'utf8');
    contacts = JSON.parse(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const savedContact = {
    id: crypto.randomUUID(),
    ...contact,
    created_at: new Date().toISOString()
  };

  contacts.push(savedContact);
  await fs.writeFile(localContactsFile, JSON.stringify(contacts, null, 2));

  return savedContact;
}

async function saveContact(contact) {
  if (!supabase) {
    const savedContact = await saveContactLocally(contact);

    return {
      savedContact,
      fallback: true,
      message: `Contact form saved locally. Supabase is not configured. Missing: ${missingSupabaseVars.join(', ')}.`
    };
  }

  try {
    const { data, error } = await supabase
      .from(contactTable)
      .insert([contact])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      savedContact: data,
      fallback: false,
      message: 'Contact form submitted successfully.'
    };
  } catch (error) {
    console.error('Supabase save failed:', error);
    const savedContact = await saveContactLocally(contact);

    return {
      savedContact,
      fallback: true,
      message: 'Contact form saved locally. Supabase save failed.',
      supabaseError: error.message || 'Unknown Supabase error'
    };
  }
}

app.post('/api/contact', async (req, res) => {
  try {
    const { name, phone, email, course, billing, amount } = req.body;

    if (!name || !phone || !email) {
      return res.status(400).json({ message: 'Name, phone, and email are required.' });
    }

    const contact = {
      name,
      phone,
      email,
      course,
      billing,
      amount
    };

    const result = await saveContact(contact);

    return res.status(201).json({
      message: result.message,
      id: result.savedContact.id,
      contact: result.savedContact,
      fallback: result.fallback,
      supabaseError: result.supabaseError
    });
  } catch (error) {
    console.error('Contact route error:', error);
    return res.status(500).json({ message: 'Server error while submitting contact form.' });
  }
});

if (require.main === module) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

module.exports = app;
