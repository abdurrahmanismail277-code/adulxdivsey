require('dotenv').config();
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const siteRoot = path.join(__dirname, '..');
const hasSupabaseConfig = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
const contactTable = process.env.CONTACT_TABLE || 'contacts';
const localContactsFile = path.join(__dirname, 'contacts.json');

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  if (req.path === '/backend' || req.path.startsWith('/backend/')) {
    return res.sendStatus(404);
  }

  next();
});

app.use(express.static(siteRoot, {
  dotfiles: 'ignore'
}));

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
      message: 'Contact form saved locally. Supabase is not configured.'
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

app.listen(port, () => console.log(`Server running on port ${port}`));
