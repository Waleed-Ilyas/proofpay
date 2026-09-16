export async function sha256ToBytes(text: string): Promise<number[]> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer));
}

export async function sha256ToHex(text: string): Promise<string> {
    const bytes = await sha256ToBytes(text);
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}