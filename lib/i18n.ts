export type Locale = "pt" | "en" | "de";

export const LOCALES: { id: Locale; label: string; flag: string }[] = [
  { id: "pt", label: "PT", flag: "🇵🇹" },
  { id: "en", label: "EN", flag: "🇬🇧" },
  { id: "de", label: "DE", flag: "🇩🇪" },
];

export const DEFAULT_LOCALE: Locale = "pt";
export const LOCALE_COOKIE = "site_lang";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "pt" || value === "en" || value === "de";
}

interface Dict {
  home: {
    tagline: string;
    stats: string;
    ctaBook: string;
    about: string;
    seePhotos: string;
    amenities: string;
    amenityKitchen: string;
    amenityWifi: string;
    amenityParking: string;
    amenityTv: string;
    amenitySelfCheckin: string;
    amenityElevator: string;
    aboutUs: string;
    alRegistration: string;
    footerRights: string;
    contact: string;
    contactEmail: string;
    contactPhone: string;
    addressRevealNotice: string;
  };
  widget: {
    perNight: string;
    cleaningFeeExtra: string;
    cleaningFeeIncluded: string;
    checkin: string;
    checkout: string;
    guests: string;
    checkAvailability: string;
    paymentMethods: string;
  };
  reservar: {
    heading: string;
    datesUnavailable: string;
    datesAvailable: string;
    invalidDateRange: string;
    priceUnavailable: string;
    checkingAvailability: string;
    guestsCount: string;
    holderName: string;
    email: string;
    phone: string;
    paymentMethod: string;
    payMbway: string;
    payCard: string;
    payTransfer: string;
    continueToPayment: string;
    processing: string;
    errorGeneric: string;
    errorConnection: string;
    transferInstructions: string;
    transferIban: string;
    transferHolder: string;
    transferReference: string;
    paymentSentGuestInfo: string;
    saveGuests: string;
    saving: string;
    errorSavingGuests: string;
    confirmed: string;
    accessReleased: string;
    waitingGuestData: string;
    waitingPayment: string;
    dontForgetTransfer: string;
    propertyDetails: string;
    address: string;
    contactPhone: string;
    minNightsError: string;
    maxNightsError: string;
    weeklyDiscountNotice: string;
    monthlyDiscountNotice: string;
    cancellationNotice: string;
    nightsLabel: string;
    totalLabel: string;
  };
  guestForm: {
    title: string;
    subtitle: string;
    guestLabel: string;
    leadGuest: string;
    fullName: string;
    nationality: string;
    documentNumber: string;
    docCC: string;
    docBI: string;
    docPassport: string;
    docResidence: string;
    docOther: string;
  };
  fotos: {
    back: string;
    heading: string;
    empty: string;
    alt: string;
  };
}

const dictionaries: Record<Locale, Dict> = {
  pt: {
    home: {
      tagline: "Casa T2 junto à Costa Vicentina",
      stats: "6 hóspedes · 2 quartos · 5 camas · 2 casas de banho · ★ 4,72",
      ctaBook: "Reservar agora",
      about: "Sobre o alojamento",
      seePhotos: "Ver fotos →",
      amenities: "Comodidades",
      amenityKitchen: "Cozinha equipada",
      amenityWifi: "Wi-Fi",
      amenityParking: "Estacionamento gratuito",
      amenityTv: "HDTV 43\" com cabo",
      amenitySelfCheckin: "Check-in autónomo",
      amenityElevator: "Elevador",
      aboutUs: "Sobre nós",
      alRegistration: "Registo AL",
      footerRights: "Todos os direitos reservados.",
      contact: "Contactos",
      contactEmail: "Email",
      contactPhone: "Telefone",
      addressRevealNotice:
        "Depois de efetuar a reserva, todos os dados da propriedade, incluindo o número de telefone e endereço, são providenciados na sua confirmação de reserva e na sua conta.",
    },
    widget: {
      perNight: "/ noite",
      cleaningFeeExtra: "+ €{fee} taxa de limpeza",
      cleaningFeeIncluded: "Taxa de limpeza incluída no total",
      checkin: "Check-in",
      checkout: "Check-out",
      guests: "Hóspedes",
      checkAvailability: "Verificar disponibilidade",
      paymentMethods: "MB WAY · Cartão · Transferência",
    },
    reservar: {
      heading: "Reservar",
      datesUnavailable: "Essas datas já não estão disponíveis. Escolha outro intervalo.",
      datesAvailable: "Datas disponíveis!",
      invalidDateRange: "A data de saída tem de ser posterior à data de entrada.",
      priceUnavailable: "Não foi possível calcular o preço para estas datas. Tente outras datas.",
      checkingAvailability: "A verificar...",
      guestsCount: "Número de hóspedes",
      holderName: "Nome do titular da reserva",
      email: "Email",
      phone: "Telefone (com indicativo, ex: 351912345678)",
      paymentMethod: "Método de pagamento",
      payMbway: "MB WAY",
      payCard: "Cartão de crédito",
      payTransfer: "Transferência bancária",
      continueToPayment: "Continuar para pagamento",
      processing: "A processar...",
      errorGeneric: "Erro ao criar reserva.",
      errorConnection: "Erro de ligação. Tente novamente.",
      transferInstructions: "Para confirmar a reserva, faça a transferência de {amount} para:",
      transferIban: "IBAN",
      transferHolder: "Titular",
      transferReference: "Referência: reserva nº {number}",
      paymentSentGuestInfo: "Pedido de pagamento enviado. Enquanto confirma, preencha os dados dos hóspedes (obrigatório por lei).",
      saveGuests: "Concluir reserva",
      saving: "A guardar...",
      errorSavingGuests: "Erro ao guardar dados dos hóspedes.",
      confirmed: "Reserva registada.",
      accessReleased: "O código de acesso já foi enviado por SMS e email.",
      waitingGuestData: "O pagamento foi confirmado, mas o código de acesso só é enviado depois de todos os hóspedes terem os dados preenchidos.",
      waitingPayment: "Assim que o pagamento for confirmado, vai receber o código de acesso por SMS e email.",
      dontForgetTransfer: "Não se esqueça de transferir {amount} para:",
      propertyDetails: "Dados da propriedade",
      address: "Morada",
      contactPhone: "Telefone",
      minNightsError: "Esta reserva exige um mínimo de {nights} noites.",
      maxNightsError: "Esta reserva permite um máximo de {nights} noites.",
      weeklyDiscountNotice: "Desconto de {percent}% aplicado por reserva semanal.",
      monthlyDiscountNotice: "Desconto de {percent}% aplicado por reserva mensal.",
      cancellationNotice: "Cancelamento grátis até {days} dias antes do check-in.",
      nightsLabel: "Preço de {nights} noite(s)",
      totalLabel: "Total",
    },
    guestForm: {
      title: "Dados dos hóspedes",
      subtitle: "Obrigatório por lei (boletim de alojamento / SIBA-AIMA) para todos os hóspedes, incluindo menores.",
      guestLabel: "Hóspede {number}",
      leadGuest: "Titular da reserva",
      fullName: "Nome completo",
      nationality: "Nacionalidade",
      documentNumber: "Número do documento",
      docCC: "Cartão de Cidadão",
      docBI: "Bilhete de Identidade",
      docPassport: "Passaporte",
      docResidence: "Título de Residência",
      docOther: "Outro documento",
    },
    fotos: {
      back: "← Voltar",
      heading: "Fotos",
      empty: "Ainda não há fotos disponíveis.",
      alt: "Foto {number} do alojamento",
    },
  },
  en: {
    home: {
      tagline: "T2 house by the Costa Vicentina",
      stats: "6 guests · 2 bedrooms · 5 beds · 2 bathrooms · ★ 4.72",
      ctaBook: "Book now",
      about: "About the property",
      seePhotos: "See photos →",
      amenities: "Amenities",
      amenityKitchen: "Fully equipped kitchen",
      amenityWifi: "Wi-Fi",
      amenityParking: "Free parking",
      amenityTv: "43\" HDTV with cable",
      amenitySelfCheckin: "Self check-in",
      amenityElevator: "Elevator",
      aboutUs: "About us",
      alRegistration: "AL registration",
      footerRights: "All rights reserved.",
      contact: "Contact",
      contactEmail: "Email",
      contactPhone: "Phone",
      addressRevealNotice:
        "After you complete your booking, all property details, including the phone number and address, are provided in your booking confirmation and in your account.",
    },
    widget: {
      perNight: "/ night",
      cleaningFeeExtra: "+ €{fee} cleaning fee",
      cleaningFeeIncluded: "Cleaning fee included in total",
      checkin: "Check-in",
      checkout: "Check-out",
      guests: "Guests",
      checkAvailability: "Check availability",
      paymentMethods: "MB WAY · Card · Bank transfer",
    },
    reservar: {
      heading: "Book",
      datesUnavailable: "Those dates are no longer available. Please choose another range.",
      datesAvailable: "Dates available!",
      invalidDateRange: "The check-out date must be after the check-in date.",
      priceUnavailable: "We could not work out a price for these dates. Please try different dates.",
      checkingAvailability: "Checking...",
      guestsCount: "Number of guests",
      holderName: "Booking holder's name",
      email: "Email",
      phone: "Phone (with country code, e.g. 351912345678)",
      paymentMethod: "Payment method",
      payMbway: "MB WAY",
      payCard: "Credit card",
      payTransfer: "Bank transfer",
      continueToPayment: "Continue to payment",
      processing: "Processing...",
      errorGeneric: "Error creating booking.",
      errorConnection: "Connection error. Please try again.",
      transferInstructions: "To confirm the booking, transfer {amount} to:",
      transferIban: "IBAN",
      transferHolder: "Account holder",
      transferReference: "Reference: booking #{number}",
      paymentSentGuestInfo: "Payment request sent. While it's confirmed, please fill in the guest details (required by law).",
      saveGuests: "Complete booking",
      saving: "Saving...",
      errorSavingGuests: "Error saving guest details.",
      confirmed: "Booking registered.",
      accessReleased: "The access code has already been sent by SMS and email.",
      waitingGuestData: "Payment has been confirmed, but the access code is only sent once all guests' details are filled in.",
      waitingPayment: "As soon as payment is confirmed, you'll receive the access code by SMS and email.",
      dontForgetTransfer: "Don't forget to transfer {amount} to:",
      propertyDetails: "Property details",
      address: "Address",
      contactPhone: "Phone",
      minNightsError: "This booking requires a minimum of {nights} nights.",
      maxNightsError: "This booking allows a maximum of {nights} nights.",
      weeklyDiscountNotice: "{percent}% discount applied for a weekly stay.",
      monthlyDiscountNotice: "{percent}% discount applied for a monthly stay.",
      cancellationNotice: "Free cancellation up to {days} days before check-in.",
      nightsLabel: "Price for {nights} night(s)",
      totalLabel: "Total",
    },
    guestForm: {
      title: "Guest details",
      subtitle: "Required by law (accommodation registration / SIBA-AIMA) for all guests, including minors.",
      guestLabel: "Guest {number}",
      leadGuest: "Booking holder",
      fullName: "Full name",
      nationality: "Nationality",
      documentNumber: "Document number",
      docCC: "Citizen card",
      docBI: "ID card",
      docPassport: "Passport",
      docResidence: "Residence permit",
      docOther: "Other document",
    },
    fotos: {
      back: "← Back",
      heading: "Photos",
      empty: "No photos available yet.",
      alt: "Photo {number} of the property",
    },
  },
  de: {
    home: {
      tagline: "T2-Haus an der Costa Vicentina",
      stats: "6 Gäste · 2 Schlafzimmer · 5 Betten · 2 Badezimmer · ★ 4,72",
      ctaBook: "Jetzt buchen",
      about: "Über die Unterkunft",
      seePhotos: "Fotos ansehen →",
      amenities: "Ausstattung",
      amenityKitchen: "Voll ausgestattete Küche",
      amenityWifi: "WLAN",
      amenityParking: "Kostenloser Parkplatz",
      amenityTv: "43\" HDTV mit Kabelanschluss",
      amenitySelfCheckin: "Selbständiger Check-in",
      amenityElevator: "Aufzug",
      aboutUs: "Über uns",
      alRegistration: "AL-Registrierung",
      footerRights: "Alle Rechte vorbehalten.",
      contact: "Kontakt",
      contactEmail: "E-Mail",
      contactPhone: "Telefon",
      addressRevealNotice:
        "Nach Abschluss Ihrer Buchung erhalten Sie alle Angaben zur Unterkunft, einschließlich Telefonnummer und Adresse, in Ihrer Buchungsbestätigung und in Ihrem Konto.",
    },
    widget: {
      perNight: "/ Nacht",
      cleaningFeeExtra: "+ €{fee} Reinigungsgebühr",
      cleaningFeeIncluded: "Reinigungsgebühr im Gesamtpreis enthalten",
      checkin: "Check-in",
      checkout: "Check-out",
      guests: "Gäste",
      checkAvailability: "Verfügbarkeit prüfen",
      paymentMethods: "MB WAY · Karte · Überweisung",
    },
    reservar: {
      heading: "Buchen",
      datesUnavailable: "Diese Termine sind nicht mehr verfügbar. Bitte wählen Sie einen anderen Zeitraum.",
      datesAvailable: "Termine verfügbar!",
      invalidDateRange: "Das Abreisedatum muss nach dem Anreisedatum liegen.",
      priceUnavailable: "Für diese Termine konnte kein Preis ermittelt werden. Bitte andere Termine wählen.",
      checkingAvailability: "Wird geprüft...",
      guestsCount: "Anzahl der Gäste",
      holderName: "Name des Buchungsinhabers",
      email: "E-Mail",
      phone: "Telefon (mit Ländervorwahl, z.B. 351912345678)",
      paymentMethod: "Zahlungsmethode",
      payMbway: "MB WAY",
      payCard: "Kreditkarte",
      payTransfer: "Banküberweisung",
      continueToPayment: "Weiter zur Zahlung",
      processing: "Wird bearbeitet...",
      errorGeneric: "Fehler beim Erstellen der Buchung.",
      errorConnection: "Verbindungsfehler. Bitte versuchen Sie es erneut.",
      transferInstructions: "Um die Buchung zu bestätigen, überweisen Sie {amount} an:",
      transferIban: "IBAN",
      transferHolder: "Kontoinhaber",
      transferReference: "Verwendungszweck: Buchung Nr. {number}",
      paymentSentGuestInfo: "Zahlungsanfrage gesendet. Bitte füllen Sie währenddessen die Gästedaten aus (gesetzlich vorgeschrieben).",
      saveGuests: "Buchung abschließen",
      saving: "Wird gespeichert...",
      errorSavingGuests: "Fehler beim Speichern der Gästedaten.",
      confirmed: "Buchung registriert.",
      accessReleased: "Der Zugangscode wurde bereits per SMS und E-Mail gesendet.",
      waitingGuestData: "Die Zahlung wurde bestätigt, aber der Zugangscode wird erst gesendet, sobald die Daten aller Gäste ausgefüllt sind.",
      waitingPayment: "Sobald die Zahlung bestätigt ist, erhalten Sie den Zugangscode per SMS und E-Mail.",
      dontForgetTransfer: "Vergessen Sie nicht, {amount} zu überweisen an:",
      propertyDetails: "Angaben zur Unterkunft",
      address: "Adresse",
      contactPhone: "Telefon",
      minNightsError: "Diese Buchung erfordert mindestens {nights} Nächte.",
      maxNightsError: "Diese Buchung erlaubt höchstens {nights} Nächte.",
      weeklyDiscountNotice: "{percent}% Rabatt für einen wöchentlichen Aufenthalt angewendet.",
      monthlyDiscountNotice: "{percent}% Rabatt für einen monatlichen Aufenthalt angewendet.",
      cancellationNotice: "Kostenlose Stornierung bis {days} Tage vor dem Check-in.",
      nightsLabel: "Preis für {nights} Nacht/Nächte",
      totalLabel: "Gesamt",
    },
    guestForm: {
      title: "Gästedaten",
      subtitle: "Gesetzlich vorgeschrieben (Meldeschein / SIBA-AIMA) für alle Gäste, einschließlich Minderjähriger.",
      guestLabel: "Gast {number}",
      leadGuest: "Buchungsinhaber",
      fullName: "Vollständiger Name",
      nationality: "Nationalität",
      documentNumber: "Dokumentennummer",
      docCC: "Personalausweis (PT)",
      docBI: "Alter Personalausweis (PT)",
      docPassport: "Reisepass",
      docResidence: "Aufenthaltstitel",
      docOther: "Anderes Dokument",
    },
    fotos: {
      back: "← Zurück",
      heading: "Fotos",
      empty: "Noch keine Fotos verfügbar.",
      alt: "Foto {number} der Unterkunft",
    },
  },
};

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/** Substitui marcadores {chave} por valores, ex: t("{amount}", {amount: "€100"}) */
export function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}
