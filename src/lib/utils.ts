import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "INR", precision: number = 0): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
    }).format(amount);
  } catch (e) {
    console.error("Currency formation error", e);
    return `${currency || "₹"} ${amount.toFixed(precision)}`;
  }
}

export function formatNumber(num: number, precision: number = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(num);
}
