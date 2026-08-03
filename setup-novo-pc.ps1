# =============================================================
#  TEG+ - Setup de ambiente local em PC novo
#  Uso:  powershell -ExecutionPolicy Bypass -File setup-novo-pc.ps1
#  Rode de dentro da pasta do repo ja clonado (C:\teg-plus).
# =============================================================

$ErrorActionPreference = "Stop"
$repo     = $PSScriptRoot
$frontend = Join-Path $repo "frontend"

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  [OK]  $msg"   -ForegroundColor Green }
function Warn($msg) { Write-Host "  [!]   $msg"   -ForegroundColor Yellow }

# -------------------------------------------------------------
# 1. Verificar pre-requisitos
# -------------------------------------------------------------
Step "1. Verificando pre-requisitos"

function Check-Cmd($name, $cmd, $minVersion) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        $ver = & $cmd --version 2>$null | Select-Object -First 1
        Ok "$name encontrado: $ver"
        return $true
    } else {
        Warn "$name NAO encontrado. Instale com: winget install $minVersion"
        return $false
    }
}

$okNode = Check-Cmd "Node.js" "node" "OpenJS.NodeJS.LTS"
$okGit  = Check-Cmd "Git"     "git"  "Git.Git"
$okGh   = Check-Cmd "GitHub CLI" "gh" "GitHub.cli"

if ($okNode) {
    $nodeMajor = (& node -v).TrimStart("v").Split(".")[0] -as [int]
    if ($nodeMajor -lt 20) { Warn "Node $nodeMajor detectado; o projeto exige Node 20+." }
}
if (-not $okNode -or -not $okGit) {
    Warn "Instale os pre-requisitos faltantes e rode o script de novo."
    exit 1
}

# -------------------------------------------------------------
# 2. Configurar identidade git (se ainda nao setada)
# -------------------------------------------------------------
Step "2. Configurando identidade git"

$gitName  = git config user.name
$gitEmail = git config user.email
if (-not $gitName)  { git config user.name  "Elton TEG";            Ok "user.name definido" }  else { Ok "user.name ja definido: $gitName" }
if (-not $gitEmail) { git config user.email "ti@teguniao.com.br";   Ok "user.email definido" } else { Ok "user.email ja definido: $gitEmail" }

# -------------------------------------------------------------
# 3. Criar arquivos .env locais (nao versionados)
# -------------------------------------------------------------
Step "3. Criando arquivos .env do frontend"

# --- .env.local (PRODUCAO) ---
$envLocal = Join-Path $frontend ".env.local"
$envLocalContent = @"
VITE_SUPABASE_URL=https://uzfjfucrinokeuwpbeie.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDE2NTgsImV4cCI6MjA4Nzc3NzY1OH0.eFf_TTijVffZxnl2xlm_Mncji1bQRHyosAALawrtZbk
VITE_APP_ENV=producao
"@
if (Test-Path $envLocal) {
    Warn ".env.local ja existe - mantido (nao sobrescrito)"
} else {
    $envLocalContent | Out-File -FilePath $envLocal -Encoding utf8 -NoNewline
    Ok ".env.local criado (aponta para PRODUCAO uzfjfucrinokeuwpbeie)"
}

# --- .env.local.homolog (TESTE / TREINAMENTO) ---
$envHomolog = Join-Path $frontend ".env.local.homolog"
$envHomologContent = @"
VITE_SUPABASE_URL=https://vxxjfxhbsklwcbhfkbes.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGpmeGhic2tsd2NiaGZrYmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDU1NDAsImV4cCI6MjA5NDQyMTU0MH0.ubttPDPW5D3KVa2Zda1-ywp3QC4dnNKu-xkNMpMIzZY
VITE_APP_ENV=homolog
"@
if (Test-Path $envHomolog) {
    Warn ".env.local.homolog ja existe - mantido"
} else {
    $envHomologContent | Out-File -FilePath $envHomolog -Encoding utf8 -NoNewline
    Ok ".env.local.homolog criado (aponta para TESTE vxxjfxhbsklwcbhfkbes)"
}

# -------------------------------------------------------------
# 4. Instalar dependencias do frontend
# -------------------------------------------------------------
Step "4. Instalando dependencias (npm install)"
Push-Location $frontend
try {
    npm install
    if ($LASTEXITCODE -eq 0) { Ok "npm install concluido" } else { Warn "npm install retornou erro $LASTEXITCODE" }
} finally {
    Pop-Location
}

# -------------------------------------------------------------
# 5. Lembrete: memoria do Claude Code (manual)
# -------------------------------------------------------------
Step "5. Memoria do Claude Code (passo MANUAL)"
$claudeMem = Join-Path $env:USERPROFILE ".claude\projects\C--teg-plus\memory"
if (Test-Path $claudeMem) {
    Ok "Memoria ja presente em: $claudeMem"
} else {
    Warn "Memoria do Claude NAO encontrada."
    Write-Host "      Copie a pasta '.claude' do PC antigo para: $env:USERPROFILE\.claude" -ForegroundColor Yellow
    Write-Host "      (contem MEMORY.md, credentials.md, settings e a conexao MCP do Supabase)" -ForegroundColor Yellow
}

# -------------------------------------------------------------
# 6. Validacao final
# -------------------------------------------------------------
Step "6. Resumo"
Write-Host "  Repo:        $repo"
Write-Host "  Frontend:    $frontend"
Write-Host "  .env.local:  $(if (Test-Path $envLocal) {'OK'} else {'FALTANDO'})"
Write-Host "  node_modules:$(if (Test-Path (Join-Path $frontend 'node_modules')) {'OK'} else {'FALTANDO'})"
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. gh auth login                 (autenticar no GitHub)"
Write-Host "  2. cd frontend ; npm run dev      (subir em http://localhost:5173)"
Write-Host "  3. (se faltou) copiar a pasta .claude do PC antigo"
Write-Host "  4. (opcional) instalar PostgreSQL 17 client p/ pg_dump/psql"
Write-Host ""
Ok "Setup concluido."
