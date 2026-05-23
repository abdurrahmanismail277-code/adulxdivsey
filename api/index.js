const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const contactTable = process.env.CONTACT_TABLE || 'contacts';
const contactsFile = path.join(__dirname, 'contacts.json');
const frontendRoot = path.resolve(__dirname, '..');
const frontendIndex = path.join(frontendRoot, 'index.html');

app.use(cors());
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});
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

app.get(['/api', '/api/health'], (req, res) => {
  res.json({
    success: true,
    message: 'API is working'
  });
});

async function saveContactLocally(contact) {
  const savedContact = {
    id: `local-${Date.now()}`,
    ...contact,
    created_at: new Date().toISOString()
  };

  let contacts = [];

  try {
    const fileContents = await fs.readFile(contactsFile, 'utf8');
    const parsedContacts = JSON.parse(fileContents);
    contacts = Array.isArray(parsedContacts) ? parsedContacts : [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  contacts.push(savedContact);
  await fs.writeFile(contactsFile, `${JSON.stringify(contacts, null, 2)}\n`);

  return savedContact;
}

function removeEmptyFields(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

app.post(['/contact', '/api/contact'], async (req, res) => {
  try {
    const { name, email, phone, message, course, billing, amount } = req.body;

    if (!name || !email || (!(message || phone))) {
      return res.status(400).json({
        success: false,
        error: 'Required fields are missing. Provide name, email, and either message or phone.'
      });
    }

    const contact = removeEmptyFields({
      name,
      email,
      phone,
      course,
      billing,
      amount,
      message
    });

    if (!supabase) {
      const savedContact = await saveContactLocally(contact);

      return res.status(201).json({
        success: true,
        message: 'Message saved locally. Supabase is not configured.',
        id: savedContact.id,
        contact: savedContact
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
      id: data && data[0] && data[0].id,
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

app.use(express.static(frontendRoot, { index: false }));

app.get('/', async (req, res, next) => {
  try {
    await fs.access(frontendIndex);
    return res.sendFile(frontendIndex);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      return next(error);
    }

    return res.json({
      success: true,
      message: 'API is working'
    });
  }
});

if (require.main === module) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

module.exports = app;
