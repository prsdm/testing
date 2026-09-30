export type TimeOfDayGreeting =
  | "Good morning"
  | "Good afternoon"
  | "Good evening";

export function getTimeOfDayGreeting(date = new Date()): TimeOfDayGreeting {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function buildGreetingHeadline(firstName?: string | null): string {
  const timeGreeting = getTimeOfDayGreeting();

  if (firstName) {
    return `${timeGreeting}, ${firstName}!`;
  }

  return `${timeGreeting}!`;
}
