const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://uzfjfucrinokeuwpbeie.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.IBpdP0V0UNn3Grtc6cbhKeWqN_P1oU6SZYkZG6Ubujg';
const BUCKET = 'contratos-anexos';
const PDF_DIR = 'C:\\teg-plus\\bases_cadastro\\01 - Locação de Imóveis';

const mappings = [
  {
    contrato_numero: 'ALG-017',
    contrato_id: 'e82bef42-f469-43c5-9914-419da6f1caab',
    loc_imovel_id: 'a362f6ad-ab20-4f9a-9f04-31b2efc0081c',
    pdf_filename: '01.03 - CONTRATO LOCAÇÃO - RUA DAS BEGONIAS N 149 TRES MARIAS-MG - AJustado venc 20 (ASSINADO) - 10.10.2025 a 10.10.2026.pdf'
  },
  {
    contrato_numero: 'ALG-015',
    contrato_id: '8ad681a1-687e-4ce7-9f61-329abcc4af92',
    loc_imovel_id: '9b975d61-05c2-44b9-b5c7-c09e4fa8dab0',
    pdf_filename: '02.04 - CONTRATO DE LOCAÇÃO - RUA MORRO AGUDO (CMM) N 26 TRES MARIAS MG - AJUSTADO (ASSINADO) - 20.10.2025 a 20.10.2026.pdf'
  },
  {
    contrato_numero: 'ALG-002',
    contrato_id: 'e8dc68ff-93b2-483a-b9ae-c30531fc063d',
    loc_imovel_id: 'd8ab904b-89ef-4975-85b1-b41b854a689f',
    pdf_filename: '02.05 - CONTRATO LOCAÇÃO - RUA RAFAEL MORENO ABRAO N 349 E 359 PERDIZES-MG (ALTERADO) - ASSINADO - 07.10.2025 a 20.12.2025.pdf'
  },
  {
    contrato_numero: 'ALG-034',
    contrato_id: 'ebaba1c0-8f71-4346-964c-e02b7e724fe9',
    loc_imovel_id: '0219973b-288c-4e5c-988f-c01868529e07',
    pdf_filename: '04.02 - CONTRATO DE LOCAÇÃO - RUA EMA PEREIRA LEITE N 475 ARAXA MG - (ASSINADO TEG) - 15.10.2025 a 15.04.2026.pdf'
  },
  {
    contrato_numero: 'ALG-019',
    contrato_id: 'fd5fbc93-6d45-4298-aa5f-16d6b6b79edf',
    loc_imovel_id: 'd807ca7e-dc81-4fb8-b471-11d29193b119',
    pdf_filename: '05.01 - CONTRATO DE LOCACAO DE TERRENO - AV GUIMARAES ROSA, 61 TRES MARIAS MG (ASSINADO) - 28.10.2025 a 28.10.2026.pdf'
  },
  {
    contrato_numero: 'ALG-040',
    contrato_id: '4e10284a-4b89-46e9-bedf-a98e3a741124',
    loc_imovel_id: 'adf93dc4-b5b4-4f0a-b420-45a4065d3744',
    pdf_filename: '06.01 - CONTRATO DE LOCACAO - RUA GUIMARAES, 676 - CENTRO - GUIMARANIA MG - ANALIA BRAZ DA SILVA (ASSINADO) - 21.10.2025 a 21.04.2026.pdf'
  },
  {
    contrato_numero: 'ALG-041',
    contrato_id: '8ca219d0-20a5-4b36-8816-82bfba4baa79',
    loc_imovel_id: 'a95c3922-edcb-475a-a19a-80a1427bb4bf',
    pdf_filename: '11.04 - CONTRATO LOCAÇÃO - RUA CORONEL JOSE FELICIANO Nº 1792 - SANTO ANTONIO - PATROCIONIO_MG (ASSINADO) - 28.10.2025 a 27.04.2026.pdf'
  },
  {
    contrato_numero: 'ALG-009',
    contrato_id: '6f9b80c3-9905-4c32-b52c-ce48628bfc94',
    loc_imovel_id: '0a6e7965-58f1-4fad-8599-fe93a9345bc3',
    pdf_filename: '2° Aditivo Contratual de Locação de Imóvel - Rua Pirajuba, 1500 - Frutal MG (ASSINADO) - 15.12.2025 a 14.04.2026.pdf'
  },
  {
    contrato_numero: 'ALG-027',
    contrato_id: 'f56439c6-6401-4830-9576-7d3edac1dcaf',
    loc_imovel_id: '35733f4f-5ef0-4bc9-9a6c-fdc7236bc57c',
    pdf_filename: 'Aditivo Contratual Avenida José Lourenço da Silva 3LJ. (ASSINADO TEG) - 10.10.2025 a 09.04.2026.pdf'
  },
  {
    contrato_numero: 'ALG-013',
    contrato_id: '11e491a7-5963-4f79-a77d-a50e5b67ce5e',
    loc_imovel_id: '45a3a930-6de0-48d6-ac03-eed0204cb1d8',
    pdf_filename: 'Contrato Locação Sebastião Imóveis - Von Glenh - Rua Miguel Couto, 128 Frutal MG (ASSINADO) - 24.11.2023 a 30.04.2026.pdf'
  },
  {
    contrato_numero: 'ALG-038',
    contrato_id: '533a8498-ba94-45cd-a0d8-c326fe9f2eab',
    loc_imovel_id: 'cd8c9ae7-6513-4db3-bbf0-afd5d64d5800',
    pdf_filename: 'CONTRATO DE LOCAÇÃO DE IMÓVEL - RUA FRANCISCO RODRIGUES LUCIO Nº 131 BAIRRO SAO BENEDITO - IBIA_MG - ASSINADO 2.pdf'
  },
  {
    contrato_numero: 'ALG-018',
    contrato_id: 'f9818cd3-5baf-40b2-84e4-5d9ab60ea53e',
    loc_imovel_id: '32b0b0d5-d9fb-4d96-bb70-6c5795500cf9',
    pdf_filename: 'Contrato Locação de Imóvel Rua João Guimaraes Rosa, 31 (ASSINADO TEG).pdf'
  },
  {
    contrato_numero: 'ALG-037',
    contrato_id: '181b2fba-6bf4-45c1-9d3b-b3880300f299',
    loc_imovel_id: 'f31ce04e-8584-4ac0-9a80-a907dafc5e38',
    pdf_filename: 'Contrato de Locacao de Imovel - Rua 08, 220 esquina com Av. Sírio Libanesa - Ituiutaba MG (ASSINADO) - 20.02.2026 a 20.04.2026.pdf'
  },
  {
    contrato_numero: null,
    contrato_id: null,
    loc_imovel_id: 'a84151ca-eec6-452a-af73-2cea3bb516c8',
    pdf_filename: 'Contrato de Locação - Rua Joao Pedro de Souza, 139 - MegaCard (ASSINADO) 24.06.2025 a 24.06.2027.pdf'
  },
  {
    contrato_numero: 'ALG-033',
    contrato_id: '25d085b4-62da-4514-a8e0-bab5a61e089b',
    loc_imovel_id: '5ce76c42-7f6c-4ec5-8f43-09db0690f423',
    pdf_filename: 'Contrato de Locação de Imóvel Rua Benedito Rezende, 718 A e B (SEM ASSINATURAS).pdf'
  }
];

function uploadFile(fileBuffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const storagePath = `locacao-imoveis/${filename}`;
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');

    const options = {
      hostname: 'uzfjfucrinokeuwpbeie.supabase.co',
      path: `/storage/v1/object/${BUCKET}/${encodedPath}`,
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
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

function getPublicUrl(filename) {
  const storagePath = `locacao-imoveis/${filename}`;
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodedPath}`;
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
      res.on('end', () => {
        resolve({ status: res.statusCode, data: chunks.join('') });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const results = [];

  for (const m of mappings) {
    const filePath = path.join(PDF_DIR, m.pdf_filename);

    if (!fs.existsSync(filePath)) {
      console.error(`FILE NOT FOUND: ${m.pdf_filename}`);
      results.push({ success: false, reason: 'file_not_found', pdf: m.pdf_filename });
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    console.log(`Uploading (${Math.round(fileBuffer.length/1024)}KB): ${m.pdf_filename.substring(0, 70)}...`);

    const uploadRes = await uploadFile(fileBuffer, m.pdf_filename, 'application/pdf');

    if (uploadRes.status !== 200) {
      console.error(`UPLOAD FAILED: ${uploadRes.status} ${JSON.stringify(uploadRes.data)}`);
      results.push({ success: false, reason: 'upload_failed', status: uploadRes.status, pdf: m.pdf_filename, error: uploadRes.data });
      continue;
    }

    const publicUrl = getPublicUrl(m.pdf_filename);
    console.log(`  -> Uploaded OK`);

    // Update con_contratos if we have a contrato_id
    if (m.contrato_id) {
      const patchRes = await patchRequest(
        `/rest/v1/con_contratos?id=eq.${m.contrato_id}`,
        { arquivo_url: publicUrl }
      );
      if (patchRes.status === 204 || patchRes.status === 200) {
        console.log(`  -> Updated con_contratos ${m.contrato_numero} arquivo_url OK`);
      } else {
        console.error(`  -> PATCH con_contratos FAILED: ${patchRes.status} ${patchRes.data}`);
      }
    }

    results.push({
      success: true,
      contrato_numero: m.contrato_numero,
      loc_imovel_id: m.loc_imovel_id,
      url: publicUrl
    });
  }

  console.log('\n=== UPLOAD SUMMARY ===');
  console.log(`Success: ${results.filter(r => r.success).length}/${results.length}`);
  results.forEach(r => {
    if (!r.success) console.log(`  FAILED: ${r.reason} - ${r.pdf}`);
  });
}

main().catch(console.error);
