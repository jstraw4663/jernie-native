import functions from '@react-native-firebase/functions';

interface GeocodeCityFound {
  found: true;
  lat: number;
  lon: number;
  city?: string;
  region?: string;
}

interface GeocodeCityNotFound {
  found: false;
}

type GeocodeCityResponse = GeocodeCityFound | GeocodeCityNotFound;

/**
 * Invokes the deployed `geocodeCity` Cloud Functions v2 callable with a free-text city query
 * and returns the resulting geocoded location (lat, lon, and best-effort city/region). Does not
 * catch errors: a rejected callable (network failure, HttpsError from the backend) propagates to
 * the caller, which decides how to handle a failed geocoding attempt (e.g. showing an error
 * message in the wizard or form).
 */
export async function geocodeCity(query: string): Promise<GeocodeCityResponse> {
  const callable = functions().httpsCallable<{ query: string }, GeocodeCityResponse>('geocodeCity');
  const response = await callable({ query });
  return response.data;
}
