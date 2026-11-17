import { one } from "./db";

// Unambiguous alphabet: no 0/O, 1/I/L
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Generates a unique short reference code like PB-4X7Q. */
export async function generateReferenceCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = `PB-${randomCode(4)}`;
    const existing = await one<{ id: string }>(
      "select id from deposit_intents where reference_code = $1",
      [code]
    );
    if (!existing) return code;
  }
  // Extremely unlikely fallback: widen the space
  return `PB-${randomCode(6)}`;
}
