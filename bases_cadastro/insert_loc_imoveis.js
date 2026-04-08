const https = require('https');

const SUPABASE_URL = 'https://uzfjfucrinokeuwpbeie.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.IBpdP0V0UNn3Grtc6cbhKeWqN_P1oU6SZYkZG6Ubujg';

// 15 active properties from PDF reading
// Mapped to their con_contratos numero
const imoveis = [
  {
    // ALG-017: Rua das Begônias, 149 - Três Marias MG
    contrato_numero: 'ALG-017',
    descricao: 'Imóvel residencial - Rua das Begônias, 149 - Três Marias MG',
    endereco: 'Rua das Begônias',
    numero: '149',
    complemento: null,
    bairro: null,
    cep: null,
    cidade: 'Três Marias',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 8000,
    dia_vencimento: 20,
    locador_nome: 'Julio Cesar Morato',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: '01.03 - CONTRATO LOCAÇÃO - RUA DAS BEGONIAS N 149 TRES MARIAS-MG - AJustado venc 20 (ASSINADO) - 10.10.2025 a 10.10.2026.pdf'
  },
  {
    // ALG-015: Rua Morro Agudo (CMM), 26 - Três Marias MG
    contrato_numero: 'ALG-015',
    descricao: 'Imóvel residencial - Rua Morro Agudo (CMM), 26 - Três Marias MG',
    endereco: 'Rua Morro Agudo',
    numero: '26',
    complemento: 'CMM',
    bairro: null,
    cep: null,
    cidade: 'Três Marias',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 3762.50,
    dia_vencimento: 20,
    locador_nome: 'Nilton Martins Magalhães Junior',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: '02.04 - CONTRATO LOCAÇÃO - RUA MORRO AGUDO (CMM) N 26 TRES MARIAS MG (ASSINADO) - 20.10.2025 a 20.10.2026.pdf'
  },
  {
    // ALG-002: Rua Rafael Moreno Abrão, 349/359 - Perdizes MG
    contrato_numero: 'ALG-002',
    descricao: 'Imóvel residencial - Rua Rafael Moreno Abrão, 349/359 - Perdizes MG',
    endereco: 'Rua Rafael Moreno Abrão',
    numero: '349/359',
    complemento: null,
    bairro: null,
    cep: null,
    cidade: 'Perdizes',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 3800,
    dia_vencimento: 7,
    locador_nome: 'Cláudia Barreto Alves Mariconi',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: '02.05 - CONTRATO LOCAÇÃO - RUA RAFAEL MORENO ABRAO N 349 E 359 PERDIZES-MG (ASSINADO) - 07.10.2025 a 20.12.2025.pdf'
  },
  {
    // ALG-034: Rua Ema Pereira Leite, 475 - Araxá MG
    contrato_numero: 'ALG-034',
    descricao: 'Imóvel residencial - Rua Ema Pereira Leite, 475 - Araxá MG',
    endereco: 'Rua Ema Pereira Leite',
    numero: '475',
    complemento: null,
    bairro: 'Guilhermina Vieira Chaer',
    cep: null,
    cidade: 'Araxá',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 3500,
    dia_vencimento: 15,
    locador_nome: 'Robert Magalhães',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: '04.02 - CONTRATO LOCAÇÃO - RUA EMA PEREIRA LEITE N 475 ARAXA MG (ASSINADO) - 15.10.2025 a 15.04.2026.pdf'
  },
  {
    // ALG-019: Av. Guimarães Rosa, 61 - Três Marias MG
    contrato_numero: 'ALG-019',
    descricao: 'Imóvel residencial - Av. Guimarães Rosa, 61 - Três Marias MG',
    endereco: 'Avenida Guimarães Rosa',
    numero: '61',
    complemento: 'Lote 5',
    bairro: null,
    cep: null,
    cidade: 'Três Marias',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 2500,
    dia_vencimento: 28,
    locador_nome: 'Comercial Três Marias Mat. de Constr.',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: '05.01 - CONTRATO LOCAÇÃO - AV GUIMARAES ROSA, 61 TRES MARIAS MG (ASSINADO) - 28.10.2025 a 28.10.2026.pdf'
  },
  {
    // ALG-040: Rua Guimarães, 676 - Centro - Guimarânia MG
    contrato_numero: 'ALG-040',
    descricao: 'Imóvel residencial - Rua Guimarães, 676 - Centro - Guimarânia MG',
    endereco: 'Rua Guimarães',
    numero: '676',
    complemento: null,
    bairro: 'Centro',
    cep: null,
    cidade: 'Guimarânia',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 1518,
    dia_vencimento: 20,
    locador_nome: 'Imobiliária Nossa Senhora Aparecida',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: '06.01 - CONTRATO LOCAÇÃO - RUA GUIMARAES, 676 - CENTRO - GUIMARANIA MG (ASSINADO) - 21.10.2025 a 21.04.2026.pdf'
  },
  {
    // ALG-041: Rua Coronel José Feliciano, 1792 - Patrocínio MG
    contrato_numero: 'ALG-041',
    descricao: 'Imóvel residencial - Rua Coronel José Feliciano, 1792 - Patrocínio MG',
    endereco: 'Rua Coronel José Feliciano',
    numero: '1792',
    complemento: null,
    bairro: 'Santo Antônio',
    cep: null,
    cidade: 'Patrocínio',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 15000,
    dia_vencimento: 28,
    locador_nome: 'Cleiton Silvério Rios Junior (Imobiliária Patrocínio LTDA)',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: '11.04 - CONTRATO LOCAÇÃO - RUA CORONEL JOSE FELICIANO Nº 1792 - PATROCIONIO_MG (ASSINADO) - 28.10.2025 a 27.04.2026.pdf'
  },
  {
    // ALG-009: Rua Pirajuba, 1500 - Frutal MG
    contrato_numero: 'ALG-009',
    descricao: 'Imóvel residencial - Rua Pirajuba, 1500 - Frutal MG',
    endereco: 'Rua Pirajuba',
    numero: '1500',
    complemento: null,
    bairro: null,
    cep: null,
    cidade: 'Frutal',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 2250,
    dia_vencimento: 15,
    locador_nome: 'Nilse Davanço',
    locador_cpf_cnpj: '471.881.546-00',
    locador_contato: null,
    nome_arquivo_pdf: '2° Aditivo - Contrato de Locação de Imóvel - Nilse Davanço - Rua Pirajuba, 1500 - Frutal MG - 15.12.2025 a 14.04.2026.pdf'
  },
  {
    // ALG-027: Av. José Lourenço da Silva, 3LJ
    contrato_numero: 'ALG-027',
    descricao: 'Imóvel residencial - Av. José Lourenço da Silva, 3LJ',
    endereco: 'Avenida José Lourenço da Silva',
    numero: '3',
    complemento: 'Loja',
    bairro: null,
    cep: null,
    cidade: null,
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 3000,
    dia_vencimento: 10,
    locador_nome: 'Valdeci José da Silva',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: 'Aditivo Contratual Avenida José Lourenço da Silva 3LJ (ASSINADO) - 10.10.2025 a 09.04.2026.pdf'
  },
  {
    // ALG-013: Rua Miguel Couto, 128 - Centro - Frutal MG
    contrato_numero: 'ALG-013',
    descricao: 'Imóvel residencial - Rua Miguel Couto, 128 - Centro - Frutal MG',
    endereco: 'Rua Miguel Couto',
    numero: '128',
    complemento: null,
    bairro: 'Centro',
    cep: '38200-112',
    cidade: 'Frutal',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 1641.20,
    dia_vencimento: 20,
    locador_nome: 'Cristiana da Silva Castino Marchi / Nádia da Silva Castino',
    locador_cpf_cnpj: '755.721.686-53 / 696.725.636-04',
    locador_contato: '(34) 9.9974-4842',
    nome_arquivo_pdf: 'Contrato Locação Sebastião Imóveis - Von Glehn - Rua Miguel Couto, 128 Frutal MG (ASSINADO) - 24.11.2023 a 30.04.2026.pdf'
  },
  {
    // ALG-038: Rua Francisco Rodrigues Lucio, 131 - São Benedito - Ibiá MG
    contrato_numero: 'ALG-038',
    descricao: 'Imóvel residencial - Rua Francisco Rodrigues Lucio, 131 - São Benedito - Ibiá MG',
    endereco: 'Rua Francisco Rodrigues Lucio',
    numero: '131',
    complemento: null,
    bairro: 'São Benedito',
    cep: null,
    cidade: 'Ibiá',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 2407.36,
    dia_vencimento: 10,
    locador_nome: 'Mônica Catarina Dias',
    locador_cpf_cnpj: '597.419.616-34',
    locador_contato: null,
    nome_arquivo_pdf: 'CONTRATO DE LOCAÇÃO DE IMÓVEL - RUA FRANCISCO RODRIGUES LUCIO Nº 131 BAIRRO SAO BENEDITO - IBIA_MG (ASSINADO) - PRAZO INDETERMINADO 06.11.2025.pdf'
  },
  {
    // ALG-018: Rua João Guimarães Rosa, 31 - Três Marias MG
    contrato_numero: 'ALG-018',
    descricao: 'Imóvel residencial - Rua João Guimarães Rosa, 31 - Três Marias MG',
    endereco: 'Rua João Guimarães Rosa',
    numero: '31',
    complemento: null,
    bairro: null,
    cep: null,
    cidade: 'Três Marias',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 6500,
    dia_vencimento: 25,
    locador_nome: 'Adilson Sebastião Alves',
    locador_cpf_cnpj: '237.470.606-20',
    locador_contato: null,
    nome_arquivo_pdf: 'Contrato Locação de Imóvel Rua João Guimaraes Rosa, 31 - Tres Marias MG (ASSINADO) - 25.11.2025 a 24.11.2026.pdf'
  },
  {
    // ALG-037: Rua 08, 220 esquina Av. Sírio Libanesa - Ituiutaba MG
    contrato_numero: 'ALG-037',
    descricao: 'Imóvel residencial - Rua 08, 220 esquina Av. Sírio Libanesa - Ituiutaba MG',
    endereco: 'Rua Oito',
    numero: '220',
    complemento: 'esquina com Av. Sírio Libanesa',
    bairro: null,
    cep: null,
    cidade: 'Ituiutaba',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 1800,
    dia_vencimento: 20,
    locador_nome: 'Eliana Gomes Durães de Souza',
    locador_cpf_cnpj: '488.686.556-91',
    locador_contato: null,
    nome_arquivo_pdf: 'Contrato de Locacao de Imovel - Rua 08, 220 - Ituiutaba MG (ASSINADO TODOS) - 20.02.2026 a 20.04.2026.pdf'
  },
  {
    // No ALG match found - Rua João Pedro de Souza, 139 - Campo Grande MS (MegaCard)
    // Looking at the list, ALG-020 is RIO BELO ENGENHARIA - Rua 03 São Gonçalo.
    // The MegaCard contract (Rua João Pedro, Campo Grande) doesn't seem to have an ALG number yet
    // Checking: ALG-020 = RUA 03 São Gonçalo, which is the unreadable file
    // The MegaCard one = Rua Joao Pedro de Souza, 139 - no match in existing contracts
    // Will insert without contrato_id link
    contrato_numero: null,
    descricao: 'Imóvel comercial - Rua João Pedro de Souza, 139 - Campo Grande MS (MegaCard)',
    endereco: 'Rua João Pedro de Souza',
    numero: '139',
    complemento: null,
    bairro: null,
    cep: null,
    cidade: 'Campo Grande',
    uf: 'MS',
    area_m2: null,
    valor_aluguel_mensal: 15000,
    dia_vencimento: 10,
    locador_nome: 'MegaCard Serviços e Intermediações LTDA',
    locador_cpf_cnpj: '00.072.951/0001-76',
    locador_contato: null,
    nome_arquivo_pdf: 'Contrato de Locação - Rua Joao Pedro de Souza, 139 - MegaCard (ASSINADO TODOS) - 24.06.2025 a 24.06.2027.pdf'
  },
  {
    // ALG-033: Rua Benedito Rezende, 718 A e B - Araxá MG
    contrato_numero: 'ALG-033',
    descricao: 'Imóvel (galpão) - Rua Benedito Rezende, 718 A e B - Vila Fertiza - Araxá MG',
    endereco: 'Rua Benedito Rezende',
    numero: '718',
    complemento: 'A e B',
    bairro: 'Vila Fertiza',
    cep: null,
    cidade: 'Araxá',
    uf: 'MG',
    area_m2: null,
    valor_aluguel_mensal: 12000,
    dia_vencimento: 20,
    locador_nome: 'LAR Assessoria Imobiliária',
    locador_cpf_cnpj: null,
    locador_contato: null,
    nome_arquivo_pdf: 'Contrato de Locação de Imóvel - Rua Benedito Rezende, 718 A e B (SEM ASSINATURAS) - 17.11.2025 a 20.11.2028.pdf'
  }
];

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'uzfjfucrinokeuwpbeie.supabase.co',
      path: path,
      method: method,
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

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
    if (data) req.write(data);
    req.end();
  });
}

async function getContratoId(numero) {
  if (!numero) return null;
  const res = await request('GET', `/rest/v1/con_contratos?numero=eq.${encodeURIComponent(numero)}&select=id`, null);
  if (res.status === 200 && res.data.length > 0) return res.data[0].id;
  return null;
}

async function main() {
  const results = [];

  for (const imovel of imoveis) {
    const contratoId = await getContratoId(imovel.contrato_numero);

    const payload = {
      descricao: imovel.descricao,
      endereco: imovel.endereco,
      numero: imovel.numero,
      complemento: imovel.complemento,
      bairro: imovel.bairro,
      cep: imovel.cep,
      cidade: imovel.cidade,
      uf: imovel.uf,
      area_m2: imovel.area_m2,
      valor_aluguel_mensal: imovel.valor_aluguel_mensal,
      dia_vencimento: imovel.dia_vencimento,
      locador_nome: imovel.locador_nome,
      locador_cpf_cnpj: imovel.locador_cpf_cnpj,
      locador_contato: imovel.locador_contato,
      status: 'ativo',
      contrato_id: contratoId
    };

    // Remove null fields
    Object.keys(payload).forEach(k => { if (payload[k] === null) delete payload[k]; });

    const res = await request('POST', '/rest/v1/loc_imoveis', payload);

    if (res.status === 201 || res.status === 200) {
      const inserted = Array.isArray(res.data) ? res.data[0] : res.data;
      results.push({
        success: true,
        id: inserted.id,
        descricao: imovel.descricao,
        contrato_numero: imovel.contrato_numero,
        contrato_id: contratoId
      });
      console.log(`OK: ${imovel.descricao.substring(0, 60)} => ${inserted.id}`);
    } else {
      results.push({
        success: false,
        descricao: imovel.descricao,
        error: JSON.stringify(res.data)
      });
      console.error(`ERRO: ${imovel.descricao.substring(0, 60)} => ${res.status}: ${JSON.stringify(res.data)}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Inserted: ${results.filter(r => r.success).length}/${results.length}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
