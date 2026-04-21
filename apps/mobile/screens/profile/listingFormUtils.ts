const CITY_ALLOWED_CHARS = /[^a-zA-Z\s'-]/g;
const CITY_VALIDATION_REGEX = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const STATE_VALIDATION_REGEX = /^[A-Z]{2}$/;
const ZIP_VALIDATION_REGEX = /^\d{5}(?:-\d{4})?$/;
const MOVE_IN_DATE_VALIDATION_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{4}$/;

export const normalizeCity = (value: string): string =>
  value
    .replace(CITY_ALLOWED_CHARS, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());

export const normalizeState = (value: string): string =>
  value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);

export const normalizeZip = (value: string): string =>
  value.replace(/[^\d-]/g, '').slice(0, 10);

export const normalizeMoveInDate = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};

export const formatMoveInDateForInput = (value: string | null | undefined): string => {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}-${iso[3]}-${iso[1]}`;
  return normalizeMoveInDate(raw);
};

export const validateListingLocation = (
  city: string,
  state: string,
  zip: string
): string | null => {
  if (!city || !state || !zip) {
    return 'Please enter city, state, and ZIP code for your listing.';
  }
  if (city.length < 2 || !CITY_VALIDATION_REGEX.test(city)) {
    return 'Enter a valid city name (letters, spaces, hyphen, and apostrophe only).';
  }
  if (!STATE_VALIDATION_REGEX.test(state)) {
    return 'Use a 2-letter state code, for example CA.';
  }
  if (!ZIP_VALIDATION_REGEX.test(zip)) {
    return 'Use a valid ZIP format like 92507 or 92507-1234.';
  }
  return null;
};

export const validateMoveInDate = (value: string): string | null => {
  if (!value) return null;
  if (!MOVE_IN_DATE_VALIDATION_REGEX.test(value)) return 'Use MM-DD-YYYY for move-in date.';
  const [monthString, dayString, yearString] = value.split('-');
  const month = Number(monthString);
  const day = Number(dayString);
  const year = Number(yearString);
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isRealDate) return 'Move-in date is not a real calendar date.';
  return null;
};

/** Parse MM-DD-YYYY or YYYY-MM-DD (or Date-parsable string) into a local calendar date. */
const parseMoveInDateToLocalDate = (value: string): Date | null => {
  const t = value.trim();
  if (!t) return null;
  const mdy = t.match(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
    return null;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
    return null;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** e.g. April 21, 2026 — for listing "Available" lines in profile/settings. */
export const formatAvailabilityForDisplay = (value: string | null | undefined): string => {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const d = parseMoveInDateToLocalDate(raw);
  if (!d) return raw;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};
