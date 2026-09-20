# Aljezur - Monte Clérigo T2 — Site de Reservas

Projeto Next.js (TypeScript, Tailwind, Postgres) para gestão do apartamento sem depender
de channel managers pagos. Construído iterativamente — ver histórico da conversa para
o raciocínio por trás de cada decisão.

---

## ✅ O que já está feito

**Reservas e pagamento**
- `app/reservar` — página pública: datas, dados do titular, pagamento (MB WAY/cartão/transferência
  bancária), formulário de hóspedes. Na transferência bancária mostra o IBAN e o número de reserva
  como referência (configurados em Definições → Pagamentos)
- `app/api/book` — cria reserva + inicia pagamento ifthenpay (ou devolve os dados da transferência) +
  dispara automaticamente a mensagem de confirmação por email (`lib/booking-messages.ts`)
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
  preço por dia editável em linha, popup para mudar preços em massa (intervalos de
  datas + dias da semana), feriados PT/DE/ES marcados com pontos coloridos, e
  **Tarifas**: botão "Aplicar tarifa" para atribuir uma tarifa a um intervalo de datas
  (com filtro de dias da semana), mostrada como uma barra colorida no topo do dia
- **Nova reserva** (`/backoffice/nova-reserva`), para Airbnb/Booking/VRBO/Outros:
  - **Colar o email da reserva**: copie o email recebido da plataforma e cole na caixa —
    os campos são lidos e preenchidos (`parseBookingEmail` em `lib/ai-vision.ts`). Mais
    fiável do que a screenshot, e traz campos que não cabem no ecrã (nº de reserva,
    comissão, contactos). Nada é gravado sem confirmação. Notas:
    - um email de **cancelamento** é detetado e recusado (não preenche nada); um de
      **alteração** preenche mas avisa, para não se criar uma reserva duplicada;
    - cada email substitui os campos por completo — ler dois emails seguidos nunca
      deixa o contacto do hóspede anterior agarrado à reserva seguinte;
    - a **Airbnb não envia email nem telemóvel** do hóspede (esconde-os de propósito):
      esses campos ficam vazios e o sistema avisa. O Booking.com envia telefone e um
      email `@guest.booking.com` que chega ao hóspede.
  - **Leitura automática por IA**: cole (Ctrl+V) ou carregue uma screenshot da reserva
    e os campos são pré-preenchidos (`lib/ai-vision.ts`, API da Anthropic)
  - Campos financeiros: preço total, comissão, custo de limpeza, nº de reserva
  - Botão WhatsApp direto para o hóspede
  - **Importação em massa** (`lib/excel-paste-parser.ts`): cole linhas copiadas do Excel e
    importe várias reservas de uma vez — não envia código Nuki nem SMS/email
    automaticamente, ao contrário do registo manual normal. Reconhece dois formatos:
    - a **exportação oficial do Booking.com** (Extranet → Reservas → exportar), com as
      colunas em português ("Número da reserva", "Nome do hóspede", "Check-in", ...);
    - a folha própria do utilizador (Nome, Contacto, Check in, ...).
    Dois cuidados que o ficheiro do Booking obriga: as **reservas canceladas vêm no
    mesmo ficheiro** e são detetadas e excluídas (senão bloqueavam noites que estão
    livres), e os **preços vêm como "425.65 EUR"**, com ponto decimal — o leitor de
    números decide pelo último separador (3 dígitos a seguir = milhares, senão decimal),
    para não transformar 425,65 € em 42 565 €
  - **O que estas exportações não trazem**: o ficheiro do Booking traz nome, datas,
    pessoas, preço, comissão e nº de reserva, mas as colunas de telefone e morada vêm
    vazias — os contactos do hóspede continuam a ter de vir do formulário de hóspedes
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
- **Definições → Mensagens**: um modelo de mensagem por tipo (confirmação de reserva,
  chaves, instruções, cancelamento, 2 personalizadas) e por idioma (PT/EN/FR/ES/DE), com
  marcadores `{nome}` `{checkin}` `{checkout}` `{codigo}` `{numero_reserva}` `{iban}`
  `{titular_conta}`. Também tem as regras de **envio automático** (X dias antes/depois
  do check-in ou check-out) — só é totalmente automático para reservas com canal Email
  (via `/api/automation/run-scheduled-messages`, a chamar por um cron externo); para
  WhatsApp não há API programável sem um provedor pago (Twilio/Meta/Vonage), por isso a
  ficha da reserva mostra um lembrete pronto a enviar manualmente quando chega a data
- Na ficha da reserva: botão **Cancelar reserva** (marca como cancelada e envia a
  mensagem de cancelamento) e um campo de **mensagem livre** para escrever e enviar
  texto avulso ao hóspede — tudo fica no histórico da conversa, incluindo o texto de
  cada mensagem enviada (pré-configurada ou livre)
- **Tarifas** (`lib/rate-plans.ts`, definidas em Definições → Regras & Preços): a tarifa
  "Normal" é aplicada por omissão; podem criar-se outras (cor própria) com cancelamento
  grátis até X dias, mínimo/máximo de noites e desconto % para reservas semanais (≥7
  noites) e mensais (≥28 noites, se ambos aplicáveis o maior desconto prevalece). A
  tarifa que governa uma reserva é a atribuída à **data de check-in** — atribuição feita
  no calendário, guardada em `date_rate_plans` (tabela: data → id da tarifa)
- **Taxas** (Definições → Regras & Preços): lista configurável de taxas somadas ao preço
  das noites (ex: limpeza, lençóis), cada uma fixa em € ou em % sobre o subtotal
- **Preço da reserva** (`lib/pricing.ts`): soma o preço de cada noite (o do calendário,
  se definido, senão o preço por omissão) − desconto semanal/mensal da tarifa + taxas =
  total. Usado tanto em `/api/pricing` (mostrado ao hóspede antes de pagar) como em
  `/api/book` (que também rejeita reservas fora do mínimo/máximo de noites da tarifa)

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
- **3 idiomas** (PT/EN/DE) — `lib/i18n.ts` (dicionários) + `lib/i18n-server.ts` (idioma
  lido de um cookie, sem rotas `/en`/`/de`) + `LanguageSwitcher`; o idioma do site é
  independente do idioma de mensagens escolhido por reserva no backoffice
- `/` — página inicial redesenhada: nav fixa com logótipo, hero, secção de comodidades,
  pré-visualização da galeria, **descrição e "Sobre nós" editáveis por idioma** no
  backoffice (Definições → Site), e **Contactos** (telefone/email/morada) sempre
  visíveis — nunca escondidos até haver reserva confirmada
- Logótipo, favicon, foto de capa e nº de registo AL geridos em Definições → Site
  (Supabase Storage), tudo refletido de imediato sem novo deploy
- `/fotos` — galeria de fotos do alojamento
- `/reservar` — datas pré-preenchidas (hoje → +7 dias), botão explícito "Verificar
  disponibilidade" que mostra o preço total (noites + desconto de tarifa + taxas) e a
  política de cancelamento antes de o hóspede avançar; mantém os dados preenchidos mesmo
  que a página recarregue (ex: ao trocar para a app do MB WAY)

**Fiabilidade**
- Todas as rotas que acedem à base de dados ou a APIs externas têm `export const
  maxDuration` explícito — sem isto, o plano Hobby da Vercel corta a função aos 10s por
  omissão, o que podia mostrar uma página em branco/presa a carregar se o Supabase
  demorasse a responder (ex: a acordar de uma pausa por inatividade)

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
