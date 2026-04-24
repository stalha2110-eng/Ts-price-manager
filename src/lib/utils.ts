import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "INR", precision: number = 0): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(amount);
}

export function formatNumber(num: number, precision: number = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(num);
}
