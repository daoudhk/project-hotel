/**
 * Integration points for health platforms. Each provider declares what it
 * would read and how the value is labelled (measured vs. estimated). Real
 * connections require the native iOS / Android apps (HealthKit and Health
 * Connect have no web API), so every provider reports "Native app" for now.
 */
export interface HealthProvider {
  id: "apple_health" | "health_connect" | "wearables";
  name: string;
  icon: "heart" | "phone" | "watch";
  reads: string[];
  availability: "Native app" | "Connected" | "Available";
}

export interface HealthSample {
  kind: "sleep_hours" | "resting_hr" | "hrv" | "steps" | "workout";
  value: number;
  date: string;
  /** Measured by a device, estimated by an algorithm, or entered by the user. */
  provenance: "measured" | "estimated" | "self-reported";
  source: HealthProvider["id"];
}

export const HEALTH_PROVIDERS: HealthProvider[] = [
  { id: "apple_health", name: "Apple Health", icon: "heart", reads: ["Sleep", "Resting HR", "HRV", "Workouts"], availability: "Native app" },
  { id: "health_connect", name: "Health Connect", icon: "phone", reads: ["Sleep", "Heart rate", "Activity"], availability: "Native app" },
  { id: "wearables", name: "Other wearables", icon: "watch", reads: ["Sleep", "Recovery data"], availability: "Native app" },
];

/** Placeholder sync: returns no data until a native bridge provides it. */
export async function syncHealth(_provider: HealthProvider["id"]): Promise<HealthSample[]> {
  return [];
}
