import type { StreamData } from '#lib/types';

// Ensure fetch is bound to globalThis in Workers isolate
if (typeof globalThis.fetch === 'function') {
	try {
		globalThis.fetch = globalThis.fetch.bind(globalThis);
	} catch {}
}

// In-memory fallback cache for development or when KV is not bound
const memoryStreamCache = new Map<string, StreamData>();

export function isStreamExpired(url: string | null | undefined): boolean {
	if (!url) return true;
	try {
		const match = url.match(/[?&]expire=(\d+)/);
		if (match && match[1]) {
			const expireEpochSec = parseInt(match[1], 10);
			const expireMs = expireEpochSec * 1000;
			// 30 minute grace window as per MECHANISM.md §3.1
			const gracePeriod = Date.now() + 30 * 60 * 1000;
			return gracePeriod >= expireMs;
		}
	} catch {
		// If parsing fails, consider safe to re-resolve
		return false;
	}
	return false;
}

function extractExpiry(url: string): number | undefined {
	const match = url.match(/[?&]expire=(\d+)/);
	if (match && match[1]) {
		return parseInt(match[1], 10) * 1000;
	}
	return undefined;
}

/**
 * Direct YouTube Innertube Android Player API
 * Direct POST without signature cipher required (as detailed in MECHANISM.md §3.1)
 */
async function resolveViaInnertubeDirect(videoId: string): Promise<StreamData | null> {
	try {
		const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip'
			},
			body: JSON.stringify({
				context: {
					client: {
						clientName: 'ANDROID',
						clientVersion: '20.10.38',
						userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
						hl: 'en',
						timeZone: 'UTC',
						utcOffsetMinutes: 0,
						osName: 'Android',
						osVersion: '11'
					}
				},
				videoId
			})
		});

		if (!res.ok) return null;
		const data = (await res.json()) as any;

		if (data.playabilityStatus?.status !== 'OK') {
			console.warn(`Innertube Android API playability status: ${data.playabilityStatus?.status}`);
			return null;
		}

		const formats: any[] = [
			...(data.streamingData?.formats || []),
			...(data.streamingData?.adaptiveFormats || [])
		];

		const audioFormats = formats
			.filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
			.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

		// Prioritize progressive format itag 18 (MP4 with AAC audio track).
		// Progressive streams include ratebypass=yes and allow arbitrary range requests
		// without YouTube googlevideo CDN throwing 403 Forbidden on chunk/unbounded boundaries.
		const preferred =
			formats.find((f) => f.itag === 18 && f.url) ||
			formats.find((f) => f.itag === 22 && f.url) ||
			audioFormats.find((f) => f.itag === 140 && f.url) ||
			audioFormats.find((f) => f.itag === 251 && f.url) ||
			audioFormats[0] ||
			formats.find((f) => f.url);

		if (!preferred || !preferred.url) return null;

		const codec = preferred.mimeType?.includes('opus')
			? 'opus'
			: preferred.mimeType?.includes('mp4a')
				? 'aac'
				: 'audio';

		return {
			videoId,
			url: preferred.url,
			itag: preferred.itag,
			codec,
			bitrate: preferred.bitrate,
			expiresAt: extractExpiry(preferred.url)
		};
	} catch (err) {
		console.warn('Innertube direct resolution failed:', err);
		return null;
	}
}

/**
 * Main stream resolver with KV caching & fallback logic
 */
export async function resolveStream(
	videoId: string,
	kv?: KVNamespace | null,
	forceRefresh: boolean = false
): Promise<StreamData> {
	// 1. Check KV or Memory cache if not forcing refresh
	if (!forceRefresh) {
		if (kv) {
			try {
				const cachedStr = await kv.get(`stream:${videoId}`);
				if (cachedStr) {
					const cached = JSON.parse(cachedStr) as StreamData;
					// Only use unexpired cached streams and avoid broken adaptive streams (itag 140/251)
					if (!isStreamExpired(cached.url) && cached.itag !== 140 && cached.itag !== 251) {
						return { ...cached, fromCache: true };
					}
				}
			} catch (err) {
				console.warn('KV cache read error:', err);
			}
		} else {
			const mem = memoryStreamCache.get(videoId);
			if (mem && !isStreamExpired(mem.url) && mem.itag !== 140 && mem.itag !== 251) {
				return { ...mem, fromCache: true };
			}
		}
	}

	// 2. Try Direct Innertube Android Player API
	const stream = await resolveViaInnertubeDirect(videoId);

	if (!stream || !stream.url) {
		throw new Error(`Failed to resolve playable audio stream for videoId: ${videoId}`);
	}

	// 3. Save to cache
	if (kv) {
		try {
			// TTL: remaining seconds minus 30 mins
			const ttlSec = stream.expiresAt
				? Math.max(60, Math.floor((stream.expiresAt - Date.now() - 30 * 60 * 1000) / 1000))
				: 14400; // 4 hours default
			await kv.put(`stream:${videoId}`, JSON.stringify(stream), { expirationTtl: ttlSec });
		} catch (err) {
			console.warn('KV cache write error:', err);
		}
	} else {
		memoryStreamCache.set(videoId, stream);
	}

	return stream;
}
