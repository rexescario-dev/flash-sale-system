const timeOpts: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  month: 'short',
};

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export type SaleWindowFormatted = {
  heading: null | string;
  range: string;
};

/** Format using the user's browser locale/timezone (no UTC rendering). */
export function formatSaleWindow(startsAt: string, endsAt: string): SaleWindowFormatted {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (sameLocalDay(start, end)) {
    const fmt = new Intl.DateTimeFormat(undefined, timeOpts);
    return {
      heading: 'Today',
      range: `${fmt.format(start)} – ${fmt.format(end)}`,
    };
  }

  const fmt = new Intl.DateTimeFormat(undefined, dateTimeOpts);
  return {
    heading: null,
    range: `${fmt.format(start)} – ${fmt.format(end)}`,
  };
}
