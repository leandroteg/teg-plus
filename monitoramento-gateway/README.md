# TEG+ · Monitoramento — Gateway on-prem (go2rtc)

Guia para ligar as câmeras Hikvision (via NVR) ao módulo **Monitoramento** do TEG+,
usando uma máquina na **mesma rede do NVR**. O ERP já está pronto — falta só o
gateway de vídeo.

```
Câmeras ──► NVR (rede local, IP tipo 192.168.x.x)
                │  RTSP (vídeo)
                ▼
        PC on-prem ── go2rtc (converte p/ o navegador)
                │  túnel HTTPS (Cloudflare)
                ▼
        TEG+ /monitoramento  (cola a URL do túnel em Configurações)
```

> 🔒 **Segurança (importante):** o NVR/câmeras **nunca** devem ser expostos direto
> na internet (nada de port-forward para eles). Só o `go2rtc` sai por HTTPS via
> túnel. Crie um **usuário dedicado** no NVR (perfil de operador/visualização),
> nunca o admin. Ideal: câmeras/NVR numa VLAN isolada.

---

## Pré-requisitos

1. Um **PC/mini-PC sempre-ligado** na **mesma rede local do NVR** (pode ser o
   mesmo do worker do WhatsApp). Windows serve.
2. O **IP local do NVR** (ex.: `192.168.0.10`) e **RTSP habilitado** no NVR.
3. Um **usuário dedicado** no NVR com permissão de visualização/RTSP.
4. Saber os **canais** das câmeras (câmera 1 = 101/102, câmera 2 = 201/202…).

---

## Passo 1 — Instalar o go2rtc

1. Baixe o `go2rtc_win64.zip` em https://github.com/AlexxIT/go2rtc/releases
2. Extraia numa pasta, ex.: `C:\teg\go2rtc\`
3. Copie o `go2rtc.yaml.example` (deste repositório) para essa pasta como
   **`go2rtc.yaml`** e preencha IP/usuário/senha do NVR e as linhas das câmeras.
4. Rode `go2rtc.exe` (duplo-clique ou pelo PowerShell).
5. Teste local: abra `http://localhost:1984` — deve listar as câmeras e tocar o
   vídeo. Se não tocar, confira o RTSP (veja "Solução de problemas").

> **Codec:** configure o **sub-stream** das câmeras em **H.264** (não H.265+/
> H.264+ "smart codec") no NVR — garante que o navegador toca sem transcodificar.

## Passo 2 — Expor por HTTPS (Cloudflare Tunnel)

O go2rtc só está em `localhost`. Para o ERP (na Vercel) alcançar, use um túnel.

**Teste rápido (URL temporária):**
```powershell
# baixe cloudflared: https://github.com/cloudflare/cloudflared/releases
cloudflared tunnel --url http://localhost:1984
```
Ele imprime uma URL `https://algo.trycloudflare.com` — já dá pra testar no ERP.

**Produção (URL fixa, recomendado):** com uma conta Cloudflare + um domínio de
vocês, crie um túnel nomeado e aponte um hostname (ex.: `cameras.teguniao.com.br`)
para `http://localhost:1984`. Passo a passo:
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

> ⚠️ O acesso remoto usa **MSE** (o player do ERP já pede `mode=mse,webrtc`), que
> passa pelo túnel HTTPS. WebRTC puro (UDP) **não** passa por túnel — mas MSE
> entrega ~1s de latência, ótimo para monitoramento.

## Passo 3 — Conectar no ERP

1. No TEG+, entre como **admin** em **/monitoramento → Configurações**.
2. Cole a **URL do túnel** (ex.: `https://cameras.teguniao.com.br`) no campo
   *Gateway de vídeo (go2rtc)* e salve.
3. Ainda em Configurações, **cadastre cada câmera**: nome, local, canal e o
   **stream_key** = o nome do stream no `go2rtc.yaml` (ex.: `cam1`).
4. Vá em **Câmeras** → o vídeo ao vivo aparece na grade. ✅

## Deixar sempre ligado (Windows)

Registre o go2rtc (e o cloudflared) como serviço com **NSSM** ou **WinSW** para
subirem no boot. Ex. com NSSM:
```powershell
nssm install teg-go2rtc "C:\teg\go2rtc\go2rtc.exe"
nssm start teg-go2rtc
```

---

## Solução de problemas

- **Vídeo não toca no go2rtc local:** teste o RTSP no VLC (`Mídia → Abrir fluxo de
  rede` com a mesma URL). Se o VLC não toca, é credencial/canal/RTSP do NVR.
- **Toca local mas não remoto:** confirme o túnel ativo e que no ERP o modo é MSE
  (já é o padrão). WebRTC não passa por túnel.
- **Trava/CPU alta:** use o **sub-stream** (102/202…) na grade e H.264 (não H.265+).
- **Usuário bloqueado no NVR:** 5 senhas erradas bloqueiam o admin por 30 min —
  por isso use um usuário dedicado e confira a senha no `go2rtc.yaml`.

---

## O que vem depois (Fase 3 — eventos)

Ver ao vivo é só o go2rtc (acima). Os **eventos** (movimento, intrusão, linha
cruzada → aba *Eventos* do ERP) precisam de um **worker Node** que escuta o NVR
via ISAPI e grava em `mon_eventos`. Esse worker será entregue aqui neste diretório
quando partirmos para a Fase 3 (mesmo padrão do worker do WhatsApp).
