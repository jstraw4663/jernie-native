// Airport code → name/city mapping.

export interface AirportInfo {
  name: string;
  city: string;
  state?: string;
  country: string;
}

export const AIRPORTS: Record<string, AirportInfo> = {
  BOS: { name: 'Logan International', city: 'Boston', state: 'MA', country: 'US' },
  BGR: { name: 'Bangor International', city: 'Bangor', state: 'ME', country: 'US' },
  PWM: { name: 'Portland International Jetport', city: 'Portland', state: 'ME', country: 'US' },
  JFK: { name: 'John F. Kennedy International', city: 'New York', state: 'NY', country: 'US' },
  LGA: { name: 'LaGuardia', city: 'New York', state: 'NY', country: 'US' },
  EWR: { name: 'Newark Liberty International', city: 'Newark', state: 'NJ', country: 'US' },
  LAX: { name: 'Los Angeles International', city: 'Los Angeles', state: 'CA', country: 'US' },
  SFO: { name: 'San Francisco International', city: 'San Francisco', state: 'CA', country: 'US' },
  ORD: { name: "O'Hare International", city: 'Chicago', state: 'IL', country: 'US' },
  MIA: { name: 'Miami International', city: 'Miami', state: 'FL', country: 'US' },
};

export function getAirportName(code: string): string {
  return AIRPORTS[code]?.name ?? code;
}

export function getAirportCity(code: string): string {
  return AIRPORTS[code]?.city ?? code;
}
