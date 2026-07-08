// Utilities for Brazilian business days (Mon-Fri, excluding national holidays)
import { addDays, parseISO, format, differenceInCalendarDays } from "date-fns";

// Computus (Meeus/Jones/Butcher) for Easter Sunday (Gregorian)
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const cache = new Map<number, Set<string>>();

export function getBrazilianHolidays(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const set = new Set<string>();
  const fixed = [
    `${year}-01-01`, // Confraternização
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Trabalho
    `${year}-09-07`, // Independência
    `${year}-10-12`, // N. Sra. Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação
    `${year}-11-20`, // Consciência Negra
    `${year}-12-25`, // Natal
  ];
  fixed.forEach((d) => set.add(d));
  const easter = easterSunday(year);
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  set.add(fmt(addDays(easter, -48))); // Carnaval segunda
  set.add(fmt(addDays(easter, -47))); // Carnaval terça
  set.add(fmt(addDays(easter, -2))); // Sexta-feira Santa
  set.add(fmt(addDays(easter, 60))); // Corpus Christi
  cache.set(year, set);
  return set;
}

export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  const holidays = getBrazilianHolidays(date.getFullYear());
  return !holidays.has(format(date, "yyyy-MM-dd"));
}

/** Next business day strictly after `date`. */
export function nextBusinessDay(date: Date): Date {
  let d = addDays(date, 1);
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

/** Add n business days (n>=0). If date itself isn't business, snaps forward first. */
export function addBusinessDays(date: Date, n: number): Date {
  let d = new Date(date);
  while (!isBusinessDay(d)) d = addDays(d, 1);
  let remaining = n;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function parseISODate(s: string): Date {
  return parseISO(s);
}

/** Calendar-day duration preserving helper */
export function calendarDaysBetween(a: Date, b: Date): number {
  return differenceInCalendarDays(b, a);
}
