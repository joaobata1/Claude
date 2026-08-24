interface BookingLike {
  id: string;
  checkin: string;
  checkout: string;
}

export interface TurnoverFlags {
  arrivalSameDayAsOtherCheckout: boolean; // alguém sai no dia em que esta reserva entra
  departureSameDayAsOtherCheckin: boolean; // alguém entra no dia em que esta reserva sai
}

/** Calcula, para cada reserva, se o dia de entrada ou de saída coincide com o de outra reserva */
export function computeTurnoverFlags(bookings: BookingLike[]): Record<string, TurnoverFlags> {
  const checkinDates = new Map<string, string[]>(); // date -> booking ids entrando nesse dia
  const checkoutDates = new Map<string, string[]>(); // date -> booking ids saindo nesse dia

  for (const b of bookings) {
    if (!checkinDates.has(b.checkin)) checkinDates.set(b.checkin, []);
    checkinDates.get(b.checkin)!.push(b.id);
    if (!checkoutDates.has(b.checkout)) checkoutDates.set(b.checkout, []);
    checkoutDates.get(b.checkout)!.push(b.id);
  }

  const result: Record<string, TurnoverFlags> = {};
  for (const b of bookings) {
    const otherCheckoutsOnArrival = (checkoutDates.get(b.checkin) ?? []).filter((id) => id !== b.id);
    const otherCheckinsOnDeparture = (checkinDates.get(b.checkout) ?? []).filter((id) => id !== b.id);
    result[b.id] = {
      arrivalSameDayAsOtherCheckout: otherCheckoutsOnArrival.length > 0,
      departureSameDayAsOtherCheckin: otherCheckinsOnDeparture.length > 0,
    };
  }
  return result;
}
