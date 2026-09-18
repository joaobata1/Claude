# Aljezur - Monte Clérigo T2 — Site de Reservas

Projeto Next.js (TypeScript, Tailwind, Postgres) para gestão do apartamento sem depender
de channel managers pagos. Construído iterativamente — ver histórico da conversa para
o raciocínio por trás de cada decisão.

---

## ✅ O que já está feito

**Reservas e pagamento**
- `app/reservar` — página pública: datas, dados do titular, pagamento (MB WAY/cartão), formulário de hóspedes
- `app/api/book` — cria reserva + inicia pagamento ifthenpay
- `app/api/pay/callback` — confirma pagamento → liberta acesso (ver abaixo)
- `lib/ifthenpay.ts` — integração MB WAY + link de pagamento por cartão

**Disponibilidade e sincronização**
- `lib/availability.ts` — cruza reservas do site com datas bloqueadas das OTAs
- `lib/ical-sync.ts` — importa **múltiplos** links iCal (lista dinâmica, sem limite) + exporta feed próprio
- `app/api/ical/import` (GET/POST, para cron externo) e `app/api/ical/export`

**Acesso (Nuki) e notificações**
- `lib/nuki.ts` — gera código temporário de acesso via Nuki Web API
- `lib/notifications.ts` — envia o código por SMS (Vonage) e email (Resend)
- `lib/access-release.ts` — módulo central que decide **quando** libertar o código,
  respeitando o interruptor "obrigar dados dos hóspedes antes do check-in"

**SIBA / AIMA**
- `lib/guests.ts` — formulário de hóspedes com preenchimento parcial aceitável
- `lib/siba.ts` — submissão SOAP real (biblioteca `node-siba`), **só hóspedes estrangeiros**
- `app/api/siba/daily-export` — relatório diário (consulta) e submissão

**Backoffice** (`app/backoffice`) — separadores: Reservas, Nova reserva, Calendário, Preços, Limpeza, Definições
- Definições organizadas em sub-separadores: iCal, Regras & Preços, Nuki, Pagamentos,
  SMS & Email, SIBA, IA, Site
- Links iCal dinâmicos, cada um com **comissão % configurável**
- Interruptor ON/OFF: obrigar dados dos hóspedes antes de enviar chave + check-in
- **Calendário** (`/backoffice/calendario`): vista mensal com reservas e bloqueios OTA,
  preço por dia editável em linha, e popup para mudar preços em massa (intervalos de
  datas + dias da semana)
- **Nova reserva** (`/backoffice/nova-reserva`), para Airbnb/Booking/VRBO/Outros:
  - **Leitura automática por IA**: cole (Ctrl+V) ou carregue uma screenshot da reserva
    e os campos são pré-preenchidos (`lib/ai-vision.ts`, API da Anthropic)
  - Campos financeiros: preço total, comissão, custo de limpeza, nº de reserva
  - Botão WhatsApp direto para o hóspede
  - **Importação em massa**: cole linhas copiadas do Excel e importe várias reservas de
    uma vez (`lib/excel-paste-parser.ts`) — não envia código Nuki nem SMS/email
    automaticamente, ao contrário do registo manual normal
- **Fotos e conteúdo do site** (sub-separador "Site" nas Definições): foto de capa,
  galeria de fotos (Supabase Storage), descrição da casa e texto "Sobre nós" — tudo
  refletido de imediato no site público, sem precisar de novo deploy
- **Ficha de reserva individual** (clicar numa linha em `/backoffice/reservas`): mostra o
  número de reserva e todos os detalhes, editáveis (hóspede, contactos, datas, valores,
  estado do pagamento), com seletor de idioma do hóspede (PT/EN/FR/ES/DE) e de canal de
  envio (WhatsApp ou Email). Tem botões **Gerar chaves** (Nuki), **Enviar chaves**,
  **Enviar instruções e regras** e 2 mensagens personalizadas — todas usam os modelos
  configurados em Definições → Mensagens, no idioma do hóspede, e ficam registadas no
  histórico de envios da reserva
- **Definições → Mensagens**: um modelo de mensagem por tipo (chaves, instruções,
  2 personalizadas) e por idioma (PT/EN/FR/ES/DE), com marcadores `{nome}` `{checkin}`
  `{checkout}` `{codigo}` `{numero_reserva}`. Também tem as regras de **envio
  automático** (X dias antes/depois do check-in ou check-out) — só é totalmente
  automático para reservas com canal Email (via `/api/automation/run-scheduled-messages`,
  a chamar por um cron externo); para WhatsApp não há API programável sem um provedor
  pago (Twilio/Meta/Vonage), por isso a ficha da reserva mostra um lembrete pronto a
  enviar manualmente quando chega a data

**Páginas de gestão**
- `/backoffice/reservas` — folha de reservas com semáforos (pagamento, dados SIBA,
  submissão SIBA, chave enviada), alerta 🧹 de limpeza no mesmo dia, exportação Excel
- `/backoffice/limpeza` — tabela de limpezas a partir de hoje, com envio direto por WhatsApp
- `/backoffice/precos` — grelha de preços por canal (21 dias), líquido já com comissão descontada
- `/api/backoffice/export-bookings` — exporta CSV (abre em Excel) na mesma ordem de
  colunas da folha original do utilizador (Nome, Check in, Check Out, Noites, n. Dias
  entre reservas, Adultos, Crianças, Obs, Plataforma, OBS, RESERVA, Contacto, Valor,
  Comissão, Limpeza, Liquido)

**Site público**
- `/` — página inicial dinâmica: preço, descrição e foto de capa vêm do backoffice
- `/fotos` — galeria de fotos do alojamento
- `/reservar` — verifica disponibilidade em tempo real ao escolher datas, mantém os
  dados preenchidos mesmo que a página recarregue (ex: ao trocar para a app do MB WAY)

---

## ☐ Checklist antes de publicar a sério

### 1. Credenciais a reunir e configurar no backoffice
| Serviço | O que precisa | Onde obter |
|---|---|---|
| Nuki | API Token + Smart Lock/Keypad ID | Nuki Web (developer.nuki.io) |
| Vonage | API Key + Secret | dashboard Vonage |
| Resend | API Key + domínio de email verificado | resend.com |
| Anthropic (leitura de screenshots) | API Key própria | console.anthropic.com |
| SIBA | Pedir mudança para "Web Service" por email a `siba@ssi.gov.pt` (NIF + nº estabelecimento) → aguardar ofício com NIPC/estabelecimento/chave de acesso | AIMA |
| iCal | Links de exportação do Airbnb, Booking, VRBO (e outros que use) | extranet de cada plataforma |
| WhatsApp da limpeza | Número em formato E.164 (ex: 351912345678) | — |

**Fora do backoffice** (variável de ambiente, não fica na base de dados):

| Variável | O que é |
|---|---|
| `BACKOFFICE_PASSWORD` | Palavra-passe de acesso ao `/backoffice`. **Obrigatória** — ver `.env.example` |
| `BACKOFFICE_SESSION_SECRET` | Opcional, segredo para assinar o cookie de sessão (senão usa a palavra-passe acima) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Para a foto de capa e galeria (Supabase Storage). Sem isto, o upload de fotos falha com um erro claro — o resto do site continua a funcionar. Ver `.env.example` para onde obter e o passo de criar o bucket "fotos" público. |

### 2. Infraestrutura
- [ ] Domínio próprio (por agora o site está no domínio `.vercel.app` gerado automaticamente)
- [x] Hosting: publicado no **Vercel**, ligado ao repositório GitHub `joaobata1/Claude`
      (branch `claude/new-session-2lks5u`) — cada `git push` a essa branch publica
      automaticamente uma nova versão. `BACKOFFICE_PASSWORD` e `DATABASE_URL` já estão
      configurados nas variáveis de ambiente do projeto Vercel.
- [x] Base de dados: Postgres (`lib/db.ts`, via biblioteca `postgres`), hospedado no
      **Supabase** (projeto `wfsnsnvaeqtarvwhyvny`, ligação via connection pooler).
      Testado em produção: guardar uma definição no backoffice persiste corretamente
      depois de recarregar a página. As tabelas foram criadas automaticamente no
      primeiro pedido — nada a correr à mão.
- [ ] Cron job externo (ex: cron-job.org) a chamar `/api/ical/import` de hora a hora
- [ ] Cron job externo (ex: cron-job.org) a chamar `/api/automation/run-scheduled-messages`
      uma vez por dia, se quiser usar o envio automático de mensagens por email

### 3. Segurança — **obrigatório antes de publicar**
- [x] Autenticação no `/backoffice` — protegido por palavra-passe (cookie de sessão
      assinado, 7 dias, `httpOnly`). Todas as páginas `/backoffice/*` e rotas
      `/api/backoffice/*` passam pelo `proxy.ts`; sem sessão válida são
      redirecionadas para `/backoffice/login` (ou devolvem 401 nas rotas de API).
      **Defina `BACKOFFICE_PASSWORD` nas variáveis de ambiente do servidor** — ver
      `.env.example` — caso contrário o backoffice fica bloqueado (503) para todos,
      incluindo o próprio dono. Opcionalmente defina também `BACKOFFICE_SESSION_SECRET`
      (senão usa `BACKOFFICE_PASSWORD` para assinar o cookie).

### 4. Testes antes de ligar a dados reais
- [ ] Reserva completa em ambiente de testes do ifthenpay
- [ ] Geração de um código Nuki de curta duração
- [ ] Confirmar chegada real de SMS e email
- [ ] Sincronização iCal nos dois sentidos (importar e exportar)
- [ ] Submissão de teste ao SIBA (ambiente `bawsdev`, não produção)

---

## Como continuar

```bash
# 1. Descompactar e instalar
npm install

# 1.5. Configurar variáveis obrigatórias
cp .env.example .env.local
# editar .env.local e definir:
#   BACKOFFICE_PASSWORD  (a palavra-passe de acesso ao /backoffice)
#   DATABASE_URL          (connection string do Postgres — Supabase/Neon têm plano grátis)

# 2. Testar localmente
npm run dev
# site:       http://localhost:3000
# backoffice: http://localhost:3000/backoffice (pede a palavra-passe definida acima)

# 3. Preencher o backoffice com as credenciais da checklist acima
```

O site já está publicado a sério (Vercel + Supabase), com autenticação do backoffice
ativa. Antes de ligar a dados reais de hóspedes, falta: domínio próprio (opcional),
o cron job externo do iCal, reunir as credenciais da secção 1 conforme forem sendo
precisas, e fazer os testes da secção 4.
