import { sql, ensureSchema } from "./db";

export type MessageType = "chaves" | "instrucoes" | "custom1" | "custom2";
export type MessageLanguage = "pt" | "en" | "fr" | "es" | "de";

export const MESSAGE_TYPES: { id: MessageType; label: string }[] = [
  { id: "chaves", label: "Envio de chaves" },
  { id: "instrucoes", label: "Instruções e regras" },
  { id: "custom1", label: "Mensagem personalizada 1" },
  { id: "custom2", label: "Mensagem personalizada 2" },
];

export const MESSAGE_LANGUAGES: { id: MessageLanguage; label: string }[] = [
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
  { id: "fr", label: "Francês" },
  { id: "es", label: "Espanhol" },
  { id: "de", label: "Alemão" },
];

export interface MessageTemplate {
  type: MessageType;
  language: MessageLanguage;
  subject: string;
  body: string;
}

/** Placeholders disponíveis nos modelos: {nome} {checkin} {checkout} {codigo} {numero_reserva} */
const DEFAULT_TEMPLATES: Record<MessageType, Record<MessageLanguage, { subject: string; body: string }>> = {
  chaves: {
    pt: {
      subject: "O seu código de acesso – Aljezur Monte Clérigo",
      body:
        "Olá {nome},\n\nBem-vindo(a) ao Aljezur - Monte Clérigo! O código de acesso à porta para a sua estadia (reserva nº {numero_reserva}) é: {codigo}\n\nCheck-in: a partir das 16h de {checkin}\nCheck-out: até às 12h de {checkout}\n\nQualquer dúvida, estamos à disposição.",
    },
    en: {
      subject: "Your access code – Aljezur Monte Clérigo",
      body:
        "Hello {nome},\n\nWelcome to Aljezur - Monte Clérigo! The door access code for your stay (booking #{numero_reserva}) is: {codigo}\n\nCheck-in: from 4 PM on {checkin}\nCheck-out: until 12 PM on {checkout}\n\nPlease let us know if you have any questions.",
    },
    fr: {
      subject: "Votre code d'accès – Aljezur Monte Clérigo",
      body:
        "Bonjour {nome},\n\nBienvenue à Aljezur - Monte Clérigo ! Le code d'accès à la porte pour votre séjour (réservation n° {numero_reserva}) est : {codigo}\n\nArrivée : à partir de 16h le {checkin}\nDépart : jusqu'à 12h le {checkout}\n\nN'hésitez pas à nous contacter pour toute question.",
    },
    es: {
      subject: "Su código de acceso – Aljezur Monte Clérigo",
      body:
        "Hola {nome},\n\n¡Bienvenido/a a Aljezur - Monte Clérigo! El código de acceso a la puerta para su estancia (reserva n.º {numero_reserva}) es: {codigo}\n\nCheck-in: a partir de las 16h del {checkin}\nCheck-out: hasta las 12h del {checkout}\n\nQuedamos a su disposición para cualquier duda.",
    },
    de: {
      subject: "Ihr Zugangscode – Aljezur Monte Clérigo",
      body:
        "Hallo {nome},\n\nWillkommen in Aljezur - Monte Clérigo! Der Türcode für Ihren Aufenthalt (Buchung Nr. {numero_reserva}) lautet: {codigo}\n\nCheck-in: ab 16 Uhr am {checkin}\nCheck-out: bis 12 Uhr am {checkout}\n\nBei Fragen stehen wir gerne zur Verfügung.",
    },
  },
  instrucoes: {
    pt: {
      subject: "Instruções e regras da casa – Aljezur Monte Clérigo",
      body:
        "Olá {nome},\n\nSeguem as instruções e regras para a sua estadia (reserva nº {numero_reserva}):\n\n- Check-in a partir das 16h de {checkin}, check-out até às 12h de {checkout}\n- Não é permitido fumar dentro do apartamento\n- Por favor, respeite o descanso dos vizinhos, especialmente entre as 22h e as 8h\n- Antes de sair, feche portas e janelas e desligue os eletrodomésticos\n\nEsperamos que tenha uma ótima estadia!",
    },
    en: {
      subject: "House rules and instructions – Aljezur Monte Clérigo",
      body:
        "Hello {nome},\n\nHere are the instructions and house rules for your stay (booking #{numero_reserva}):\n\n- Check-in from 4 PM on {checkin}, check-out until 12 PM on {checkout}\n- No smoking inside the apartment\n- Please respect the neighbours' rest, especially between 10 PM and 8 AM\n- Before leaving, please close all doors and windows and turn off appliances\n\nWe hope you enjoy your stay!",
    },
    fr: {
      subject: "Règles et instructions de la maison – Aljezur Monte Clérigo",
      body:
        "Bonjour {nome},\n\nVoici les instructions et règles de la maison pour votre séjour (réservation n° {numero_reserva}) :\n\n- Arrivée à partir de 16h le {checkin}, départ jusqu'à 12h le {checkout}\n- Il est interdit de fumer à l'intérieur de l'appartement\n- Merci de respecter le repos des voisins, en particulier entre 22h et 8h\n- Avant de partir, veuillez fermer les portes et fenêtres et éteindre les appareils\n\nNous vous souhaitons un excellent séjour !",
    },
    es: {
      subject: "Normas e instrucciones de la casa – Aljezur Monte Clérigo",
      body:
        "Hola {nome},\n\nAquí tiene las instrucciones y normas de la casa para su estancia (reserva n.º {numero_reserva}):\n\n- Check-in a partir de las 16h del {checkin}, check-out hasta las 12h del {checkout}\n- No está permitido fumar dentro del apartamento\n- Por favor, respete el descanso de los vecinos, especialmente entre las 22h y las 8h\n- Antes de salir, cierre puertas y ventanas y apague los electrodomésticos\n\n¡Esperamos que disfrute de su estancia!",
    },
    de: {
      subject: "Hausregeln und Anweisungen – Aljezur Monte Clérigo",
      body:
        "Hallo {nome},\n\nHier sind die Anweisungen und Hausregeln für Ihren Aufenthalt (Buchung Nr. {numero_reserva}):\n\n- Check-in ab 16 Uhr am {checkin}, Check-out bis 12 Uhr am {checkout}\n- Rauchen in der Wohnung ist nicht gestattet\n- Bitte respektieren Sie die Nachtruhe der Nachbarn, insbesondere zwischen 22 und 8 Uhr\n- Bitte schließen Sie vor der Abreise alle Türen und Fenster und schalten Sie die Geräte aus\n\nWir wünschen Ihnen einen angenehmen Aufenthalt!",
    },
  },
  custom1: {
    pt: { subject: "", body: "" },
    en: { subject: "", body: "" },
    fr: { subject: "", body: "" },
    es: { subject: "", body: "" },
    de: { subject: "", body: "" },
  },
  custom2: {
    pt: { subject: "", body: "" },
    en: { subject: "", body: "" },
    fr: { subject: "", body: "" },
    es: { subject: "", body: "" },
    de: { subject: "", body: "" },
  },
};

export function getDefaultTemplate(type: MessageType, language: MessageLanguage) {
  return DEFAULT_TEMPLATES[type][language];
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

/** Modelo guardado no backoffice para este tipo+idioma, ou o modelo por omissão se ainda não foi personalizado. */
export async function getTemplate(type: MessageType, language: MessageLanguage): Promise<MessageTemplate> {
  await ensureSchema();
  const rows = await sql<{ subject: string; body: string }[]>`
    SELECT subject, body FROM message_templates WHERE type = ${type} AND language = ${language}
  `;
  if (rows[0]) return { type, language, subject: rows[0].subject, body: rows[0].body };
  const fallback = getDefaultTemplate(type, language);
  return { type, language, subject: fallback.subject, body: fallback.body };
}

/** Todos os modelos guardados no backoffice (só os personalizados — o resto usa o valor por omissão). */
export async function getAllStoredTemplates(): Promise<MessageTemplate[]> {
  await ensureSchema();
  const rows = await sql<{ type: string; language: string; subject: string; body: string }[]>`
    SELECT type, language, subject, body FROM message_templates
  `;
  return rows as MessageTemplate[];
}

export async function saveTemplate(t: MessageTemplate): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO message_templates (type, language, subject, body)
    VALUES (${t.type}, ${t.language}, ${t.subject}, ${t.body})
    ON CONFLICT (type, language) DO UPDATE SET subject = excluded.subject, body = excluded.body
  `;
}
