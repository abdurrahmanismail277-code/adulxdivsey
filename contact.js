const fs = require('fs');
const path = require('path');
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

loadEnvFile(path.join(__dirname, '..', '..', '.env'));
loadEnvFile(path.join(__dirname, '..', '..', 'backend', '.env'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

function createLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getLocalContactsPath() {
  return (
    process.env.LOCAL_CONTACTS_FILE ||
    path.join(__dirname, '..', '..', '.local', 'contacts.json')
  );
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

function saveLocalContact(contact) {
  const savedContact = {
    id: createLocalId(),
    ...contact,
    created_at: new Date().toISOString(),
    storage: 'local-json'
  };

  const primaryPath = getLocalContactsPath();
  const fallbackPath = path.join(os.tmpdir(), 'contacts.json');

  for (const filePath of [primaryPath, fallbackPath]) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const contacts = readJsonArray(filePath);
      contacts.push(savedContact);
      fs.writeFileSync(filePath, JSON.stringify(contacts, null, 2));
      return { savedContact, filePath };
    } catch (error) {
      // Try the next writable location.
    }
  }

  throw new Error('Unable to write local contacts JSON file.');
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { message: 'Method not allowed.' });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { message: 'Invalid JSON body.' });
  }

  const { name, phone, email, course, billing, amount } = payload;

  if (!name || !phone || !email) {
    return json(400, { message: 'Name, phone, and email are required.' });
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
      const { savedContact, filePath } = saveLocalContact(contact);

      return json(201, {
        message: 'Contact form submitted successfully using local JSON fallback.',
        id: savedContact.id,
        contact: savedContact,
        localFallback: true,
        filePath,
        missingSupabaseVars: [
          supabaseUrl ? null : 'SUPABASE_URL',
          supabaseKey ? null : 'SUPABASE_SERVICE_ROLE_KEY'
        ].filter(Boolean)
      });
    } catch (error) {
      return json(500, {
        message: 'Supabase is not configured and local JSON fallback failed.',
        detail: error.message
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
      return json(response.status, { message: message || 'Supabase save failed.' });
    }

    const savedContact = Array.isArray(data) ? data[0] : data;

    return json(201, {
      message: 'Contact form submitted successfully.',
      id: savedContact && savedContact.id,
      contact: savedContact
    });
  } catch (error) {
    return json(500, {
      message: 'Server error while submitting contact form.',
      detail: error.message
    });
  }
};
