/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local-date helpers. Using toISOString() to derive a YYYY-MM-DD is a trap in
 * negative-offset timezones (e.g. Mexico, UTC-6): after ~6pm local it returns
 * the NEXT day, and parsing "YYYY-MM-DD" back yields the PREVIOUS day. These
 * helpers always work in the device's local calendar day.
 */

/** Format a Date as local YYYY-MM-DD. */
export function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayLocalYmd(): string {
  return toLocalYmd(new Date());
}
