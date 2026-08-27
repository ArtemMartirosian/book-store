const YEREVAN_TIME_ZONE = 'Asia/Yerevan';

export function yerevanOrderDateStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: YEREVAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  if (!year || !month || !day) throw new Error('Unable to format the Yerevan business date');
  return `${year}${month}${day}`;
}
