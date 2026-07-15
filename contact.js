const path = require('path');
const fs = require('fs');
const os = require('os');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] || '';
    value = value.replace(/^(['"])(.*)\1$/, '$2');

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '..', '.env'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function send(res, statusCode, body) {
  Object.entries({
    ...corsHeaders,
    'Content-Type': 'application/json'
  }).forEach(([key, value]) => res.setHeader(key, value));

  return res.status(statusCode).json(body);
}

function createLocalId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function saveContactLocally(contact) {
  const contactWithId = {
    id: createLocalId(),
    ...contact,
    created_at: new Date().toISOString(),
    storage: 'local-json'
  };

  const candidatePaths = [
    process.env.LOCAL_CONTACTS_FILE,
    path.join(__dirname, 'contacts.json'),
    path.join(__dirname, '..', '.local', 'contacts.json'),
    path.join(os.tmpdir(), 'contacts.json')
  ].filter(Boolean);

  for (const contactsPath of candidatePaths) {
    try {
      fs.mkdirSync(path.dirname(contactsPath), { recursive: true });
      const contacts = readJsonArray(contactsPath);
      contacts.push(contactWithId);
      fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
      return { contactWithId, contactsPath };
    } catch (error) {
      // Try the next writable location.
    }
  }

  throw new Error('Unable to write local contacts JSON file.');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return send(res, 405, { message: 'Method not allowed.' });
  }

  const { name, phone, email, course, billing, amount } = req.body || {};

  if (!name || !phone || !email) {
    return send(res, 400, { message: 'Name, phone, and email are required.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const contactTable = process.env.CONTACT_TABLE || 'contacts';

  const contact = {
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    course,
    billing,
    amount
  };

  if (!supabaseUrl || !supabaseKey) {
    try {
      const { contactWithId, contactsPath } = saveContactLocally(contact);
      return send(res, 201, {
        message: 'Contact form submitted successfully (saved locally).',
        id: contactWithId.id,
        contact: contactWithId,
        localFallback: true,
        filePath: contactsPath
      });
    } catch (fallbackError) {
      return send(res, 500, {
        message: 'Supabase environment variables are not configured and local save failed.',
        detail: fallbackError.message
      });
    }
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${contactTable}`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(contact)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data && (data.message || data.error || data.details);
      try {
        const { contactWithId, contactsPath } = saveContactLocally(contact);

        return send(res, 201, {
          message: 'Contact form submitted successfully (saved locally).',
          id: contactWithId.id,
          contact: contactWithId,
          localFallback: true,
          filePath: contactsPath,
          supabaseError: message || 'Supabase save failed.',
          detail: response.status === 401
            ? 'The Supabase API key is not valid for the configured SUPABASE_URL.'
            : undefined
        });
      } catch (fallbackError) {
        return send(res, response.status, {
          message: message || 'Supabase save failed.',
          detail: fallbackError.message
        });
      }
    }

    const savedContact = Array.isArray(data) ? data[0] : data;

    return send(res, 201, {
      message: 'Contact form submitted successfully.',
      id: savedContact && savedContact.id,
      contact: savedContact
    });
  } catch (error) {
    try {
      const { contactWithId, contactsPath } = saveContactLocally(contact);

      return send(res, 201, {
        message: 'Contact form submitted successfully (saved locally).',
        id: contactWithId.id,
        contact: contactWithId,
        localFallback: true,
        filePath: contactsPath
      });
    } catch (fallbackError) {
      return send(res, 500, {
        message: 'Server error while submitting contact form.',
        detail: fallbackError.message
      });
    }
  }
};
