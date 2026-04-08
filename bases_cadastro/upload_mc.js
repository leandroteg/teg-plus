const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://uzfjfucrinokeuwpbeie.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.IBpdP0V0UNn3Grtc6cbhKeWqN_P1oU6SZYkZG6Ubujg';
const BUCKET = 'contratos-anexos';

const PDF_DIR = 'C:\\teg-plus\\bases_cadastro\\01 - Loca\u00e7\u00e3o de Im\u00f3veis';

function uploadFile(fileBuffer, storageKey, contentType) {
  return new Promise((resolve, reject) => {
    const encodedKey = encodeURIComponent(storageKey);
    const fullPath = `/storage/v1/object/${BUCKET}/locacao-imoveis/${encodedKey}`;
    const options = {
      hostname: 'uzfjfucrinokeuwpbeie.supabase.co',
      path: fullPath,
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'x-upsert': 'true'
      }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const body = chunks.join('');
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

function patchRequest(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'uzfjfucrinokeuwpbeie.supabase.co',
      path: urlPath,
      method: 'PATCH',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Prefer': 'return=minimal'
      }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, data: chunks.join('') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Read directory to find the exact file
  const files = fs.readdirSync(PDF_DIR);
  const mc = files.find(f => f.includes('Glenh') || f.includes('Sebasti'));
  if (!mc) { console.error('NOT FOUND'); return; }
  console.log('Found file:', mc);

  const diskPath = path.join(PDF_DIR, mc);
  const storageKey = 'Contrato Locacao Sebastiao Imoveis - Von Glehn - Rua Miguel Couto, 128 Frutal MG (ASSINADO) - 24.11.2023 a 30.04.2026.pdf';

  const fileBuffer = fs.readFileSync(diskPath);
  console.log(`Size: ${Math.round(fileBuffer.length/1024)}KB`);

  const uploadRes = await uploadFile(fileBuffer, storageKey, 'application/pdf');
  if (uploadRes.status !== 200) {
    console.error('UPLOAD FAILED:', uploadRes.status, JSON.stringify(uploadRes.data));
    return;
  }
  console.log('Upload OK');

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/locacao-imoveis/${encodeURIComponent(storageKey)}`;
  console.log('URL:', publicUrl);

  // Update con_contratos ALG-013
  const patchRes = await patchRequest(
    '/rest/v1/con_contratos?id=eq.11e491a7-5963-4f79-a77d-a50e5b67ce5e',
    { arquivo_url: publicUrl }
  );
  console.log('PATCH status:', patchRes.status);
}

main().catch(console.error);
