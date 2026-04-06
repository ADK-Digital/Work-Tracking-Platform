export type AppMode = "standard" | "demo";

const normalizeMode = (value: string | undefined): AppMode => {
  if (!value) {
    return "standard";
  }

  return value.trim().toLowerCase() === "demo" ? "demo" : "standard";
};

export const APP_MODE: AppMode = normalizeMode(import.meta.env.VITE_APP_MODE);

export const isDemoMode = APP_MODE === "demo";
