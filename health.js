exports.handler = async function handler() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({ ok: true })
  };
};

exports.config = {
  path: '/api/health'
};
