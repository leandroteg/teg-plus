# =============================================================
#  TEG+ - Bootstrap completo de PC novo (standalone)
#
#  Copie SO este arquivo para o PC novo e rode:
#     powershell -ExecutionPolicy Bypass -File bootstrap-teg-plus.ps1
#
#  Faz o maximo automatico:
#    - instala Git, Node LTS, GitHub CLI, Python e VS Code (via winget)
#    - clona o repo em C:\teg-plus
#    - cria os .env locais (producao + homolog)
#    - roda npm install
#    - baixa o client PostgreSQL 17 (pg_dump/psql) em C:\teg-plus\tools
#    - deixa lembretes do que e manual (login gh + pasta .claude)
# =============================================================

$ErrorActionPreference = "Stop"
$RepoUrl  = "https://github.com/leandroteg/teg-plus.git"
$RepoDir  = "C:\teg-plus"
$Frontend = Join-Path $RepoDir "frontend"
$ToolsDir = Join-Path $RepoDir "tools"

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [OK]  $m"   -ForegroundColor Green }
function Warn($m) { Write-Host "  [!]   $m"   -ForegroundColor Yellow }
function Err($m)  { Write-Host "  [X]   $m"   -ForegroundColor Red }

# Recarrega o PATH no processo atual (necessario depois de winget install)
function Refresh-Path {
    $m = [Environment]::GetEnvironmentVariable("Path","Machine")
    $u = [Environment]::GetEnvironmentVariable("Path","User")
    $env:Path = "$m;$u"
}

# -------------------------------------------------------------
# 0. Pre-checagem: winget disponivel?
# -------------------------------------------------------------
Step "0. Verificando winget"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Err "winget nao encontrado. Atualize o 'App Installer' pela Microsoft Store e rode de novo."
    exit 1
}
Ok "winget disponivel"

# -------------------------------------------------------------
# 1. Instalar ferramentas (idempotente)
# -------------------------------------------------------------
Step "1. Instalando ferramentas via winget"

function Install-Pkg($id, $name, [switch]$Optional) {
    # ja instalado?
    $listed = winget list --id $id -e 2>$null | Out-String
    if ($listed -match [Regex]::Escape($id)) { Ok "$name ja instalado"; return }
    Write-Host "  ...instalando $name ($id)" -ForegroundColor Gray
    winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) { Ok "$name instalado" }
    elseif ($Optional)       { Warn "$name falhou (opcional) - seguindo" }
    else                     { Err  "$name falhou (exit $LASTEXITCODE)" }
}

Install-Pkg "Git.Git"          "Git"
Install-Pkg "OpenJS.NodeJS.LTS" "Node.js LTS"
Install-Pkg "GitHub.cli"       "GitHub CLI"
Install-Pkg "Python.Python.3.12" "Python 3.12" -Optional
Install-Pkg "Microsoft.VisualStudioCode" "VS Code" -Optional

Refresh-Path

# valida Node 20+
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeMajor = (& node -v).TrimStart("v").Split(".")[0] -as [int]
    if ($nodeMajor -lt 20) { Warn "Node $nodeMajor < 20. Feche e reabra o terminal e rode de novo." }
    else { Ok "Node $(node -v)" }
} else {
    Err "Node nao aparece no PATH ainda. Feche/reabra o PowerShell e rode o script de novo."
    exit 1
}

# -------------------------------------------------------------
# 2. Clonar o repositorio
# -------------------------------------------------------------
Step "2. Clonando repositorio"
if (Test-Path (Join-Path $RepoDir ".git")) {
    Ok "Repo ja existe em $RepoDir - fazendo git pull"
    Push-Location $RepoDir
    try { git pull --ff-only } catch { Warn "git pull falhou (continua)" }
    Pop-Location
} else {
    git clone $RepoUrl $RepoDir
    if ($LASTEXITCODE -ne 0) { Err "git clone falhou"; exit 1 }
    Ok "Clonado em $RepoDir"
}

# identidade git
Push-Location $RepoDir
if (-not (git config user.name))  { git config user.name  "Elton TEG" }
if (-not (git config user.email)) { git config user.email "ti@teguniao.com.br" }
Ok "git identidade: $(git config user.name) <$(git config user.email)>"
Pop-Location

# -------------------------------------------------------------
# 3. Criar arquivos .env (nao versionados)
# -------------------------------------------------------------
Step "3. Criando .env do frontend"

$envLocal = Join-Path $Frontend ".env.local"
@"
VITE_SUPABASE_URL=https://uzfjfucrinokeuwpbeie.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDE2NTgsImV4cCI6MjA4Nzc3NzY1OH0.eFf_TTijVffZxnl2xlm_Mncji1bQRHyosAALawrtZbk
VITE_APP_ENV=producao
"@ | ForEach-Object { if (Test-Path $envLocal) { Warn ".env.local ja existe - mantido" } else { $_ | Out-File $envLocal -Encoding utf8 -NoNewline; Ok ".env.local criado (PRODUCAO)" } }

$envHomolog = Join-Path $Frontend ".env.local.homolog"
@"
VITE_SUPABASE_URL=https://vxxjfxhbsklwcbhfkbes.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGpmeGhic2tsd2NiaGZrYmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDU1NDAsImV4cCI6MjA5NDQyMTU0MH0.ubttPDPW5D3KVa2Zda1-ywp3QC4dnNKu-xkNMpMIzZY
VITE_APP_ENV=homolog
"@ | ForEach-Object { if (Test-Path $envHomolog) { Warn ".env.local.homolog ja existe - mantido" } else { $_ | Out-File $envHomolog -Encoding utf8 -NoNewline; Ok ".env.local.homolog criado (TESTE)" } }

# -------------------------------------------------------------
# 4. npm install
# -------------------------------------------------------------
Step "4. Instalando dependencias do frontend"
Push-Location $Frontend
try {
    npm install
    if ($LASTEXITCODE -eq 0) { Ok "npm install concluido" } else { Warn "npm install retornou $LASTEXITCODE" }
} finally { Pop-Location }

# -------------------------------------------------------------
# 5. PostgreSQL 17 client (pg_dump / psql) - portatil
# -------------------------------------------------------------
Step "5. Baixando client PostgreSQL 17 (portatil)"
$pgBin = Join-Path $ToolsDir "pgsql\bin"
if (Test-Path (Join-Path $pgBin "psql.exe")) {
    Ok "PostgreSQL client ja presente em $pgBin"
} else {
    try {
        New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
        # binarios portateis do EDB (sem instalador)
        $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-17.2-1-windows-x64-binaries.zip"
        $pgZip = Join-Path $ToolsDir "pgsql17.zip"
        Write-Host "  ...baixando $pgUrl" -ForegroundColor Gray
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgZip -UseBasicParsing
        Expand-Archive -Path $pgZip -DestinationPath $ToolsDir -Force
        Remove-Item $pgZip -Force
        if (Test-Path (Join-Path $pgBin "psql.exe")) { Ok "PostgreSQL 17 client em $pgBin" }
        else { Warn "ZIP extraido mas psql.exe nao encontrado - confira $ToolsDir" }
    } catch {
        Warn "Falha ao baixar PostgreSQL client (opcional): $($_.Exception.Message)"
        Warn "Baixe manual em https://www.enterprisedb.com/download-postgresql-binaries"
    }
}

# -------------------------------------------------------------
# 6. Checagens / passos manuais
# -------------------------------------------------------------
Step "6. Passos que precisam de voce"

# login GitHub
$ghLogged = $false
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh auth status 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) { Ok "GitHub CLI ja autenticado"; $ghLogged = $true }
}
if (-not $ghLogged) { Warn "Rode 'gh auth login' para autenticar no GitHub" }

# memoria do Claude
$claudeMem = Join-Path $env:USERPROFILE ".claude\projects\C--teg-plus\memory"
if (Test-Path $claudeMem) { Ok "Memoria do Claude presente" }
else {
    Warn "Copie a pasta '.claude' do PC antigo para: $env:USERPROFILE\.claude"
    Warn "  (MEMORY.md, credentials.md, settings e a conexao MCP do Supabase)"
}

# Claude Code CLI (instala via npm se quiser)
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Warn "Claude Code nao instalado. Opcional: npm install -g @anthropic-ai/claude-code"
} else { Ok "Claude Code CLI presente" }

# -------------------------------------------------------------
# 7. Resumo final
# -------------------------------------------------------------
Step "7. Resumo"
Write-Host "  Repo:          $RepoDir"
Write-Host "  .env.local:    $(if (Test-Path $envLocal) {'OK'} else {'FALTANDO'})"
Write-Host "  node_modules:  $(if (Test-Path (Join-Path $Frontend 'node_modules')) {'OK'} else {'FALTANDO'})"
Write-Host "  pg client:     $(if (Test-Path (Join-Path $pgBin 'psql.exe')) {'OK'} else {'nao instalado'})"
Write-Host ""
Write-Host "Para subir o app:" -ForegroundColor Cyan
Write-Host "  cd $Frontend"
Write-Host "  npm run dev        ->  http://localhost:5173"
Write-Host ""
Ok "Bootstrap concluido."
