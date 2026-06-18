import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function getErrorMessage(error: any): Promise<string> {
  if (!error) return "Terjadi kesalahan";
  
  if (error.context && typeof error.context.json === 'function') {
    try {
      const clonedResponse = error.context.clone();
      const body = await clonedResponse.json();
      return body?.error || body?.message || error.message;
    } catch {
      try {
        const clonedResponse = error.context.clone();
        const text = await clonedResponse.text();
        return text || error.message;
      } catch {
        return error.message;
      }
    }
  }
  
  return error.message || "Terjadi kesalahan";
}
