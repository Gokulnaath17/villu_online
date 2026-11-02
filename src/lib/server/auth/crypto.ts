/**
 * Web Crypto PBKDF2-HMAC-SHA256 password hashing & secure token generation
 * Native to Cloudflare Workers workerd runtime (no native/node-gyp dependencies).
 */

const DEFAULT_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256; // 32 bytes

export function bufferToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function hexToBuffer(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return bytes;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Buffer.from(bytes).toString('base64url');
}

export async function hashPassword(
	password: string,
	iterations = DEFAULT_ITERATIONS
): Promise<{ hash: string; salt: string; iterations: number }> {
	const saltBytes = crypto.getRandomValues(new Uint8Array(16));
	const salt = bufferToHex(saltBytes);

	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: saltBytes as any,
			iterations,
			hash: 'SHA-256'
		},
		keyMaterial,
		KEY_LENGTH_BITS
	);

	const hash = bufferToHex(new Uint8Array(derivedBits));
	return { hash, salt, iterations };
}

export async function verifyPassword(
	password: string,
	expectedHash: string,
	salt: string,
	iterations = DEFAULT_ITERATIONS
): Promise<boolean> {
	try {
		const saltBytes = hexToBuffer(salt);
		const expectedBytes = hexToBuffer(expectedHash);

		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(password),
			'PBKDF2',
			false,
			['deriveBits']
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				salt: saltBytes as any,
				iterations,
				hash: 'SHA-256'
			},
			keyMaterial,
			KEY_LENGTH_BITS
		);

		const actualBytes = new Uint8Array(derivedBits);
		return timingSafeEqual(expectedBytes, actualBytes);
	} catch (err) {
		console.warn('verifyPassword error:', err);
		return false;
	}
}
