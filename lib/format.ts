const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatDate = (value: Date | string): string => dateFormatter.format(new Date(value));
export const formatNumber = (value: number): string => new Intl.NumberFormat("en-US").format(value);
