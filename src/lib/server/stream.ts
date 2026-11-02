import { Innertube } from 'youtubei.js/cf-worker';
import type { StreamData } from '#lib/types';

// Ensure fetch is bound to globalThis in Workers isolate
if (typeof globalThis.fetch === 'function') {
	try {
		globalThis.fetch = globalThis.fetch.bind(globalThis);
	} catch {}
}

// In-memory fallback cache for development or when KV is not bound
const memoryStreamCache = new Map<string, StreamData>();

// Singleton Innertube instance
let innertubePromise: Promise<Innertube> | null = null;

async function getInnertube(): Promise<Innertube> {
	if (!innertubePromise) {
		innertubePromise = Innertube.create().catch((err) => {
			innertubePromise = null;
			throw err;
		});
	}
	return innertubePromise;
}

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
 * Tier 5: Direct YouTube Innertube Android Player API
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
			...(data.streamingData?.adaptiveFormats || []),
			...(data.streamingData?.formats || [])
		];

		const audioFormats = formats
			.filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
			.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

		if (audioFormats.length === 0) return null;

		// Prioritize progressive format itag 18 (MP4 with AAC audio) for flawless web range seeking,
		// then fallback to itag 140 (AAC) or itag 251 (Opus)
		const preferred =
			formats.find((f) => f.itag === 18 && f.url) ||
			audioFormats.find((f) => f.itag === 140 && f.url) ||
			audioFormats.find((f) => f.itag === 251 && f.url) ||
			audioFormats[0];

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
 * Tier 6: youtubei.js resolution fallback
 */
async function resolveViaYoutubei(videoId: string): Promise<StreamData | null> {
	try {
		const yt = await getInnertube();
		const info = await yt.getInfo(videoId);

		if (!info || !info.streaming_data) return null;

		const audioFormats = (info.streaming_data.adaptive_formats || [])
			.filter((f) => f.has_audio && !f.has_video)
			.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

		if (audioFormats.length === 0) return null;

		const best =
			audioFormats.find((f) => f.itag === 140) ||
			audioFormats.find((f) => f.itag === 251) ||
			audioFormats[0];

		// Decide URL using decipher if needed
		let url = best.url;
		if (!url && typeof (best as any).decipher === 'function') {
			url = await (best as any).decipher(yt.session.player);
		}

		if (!url) return null;

		return {
			videoId,
			url,
			itag: best.itag,
			codec: best.mime_type?.includes('opus') ? 'opus' : 'aac',
			bitrate: best.bitrate,
			expiresAt: extractExpiry(url)
		};
	} catch (err) {
		console.error('youtubei.js resolution failed:', err);
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
					if (!isStreamExpired(cached.url)) {
						return { ...cached, fromCache: true };
					}
				}
			} catch (err) {
				console.warn('KV cache read error:', err);
			}
		} else {
			const mem = memoryStreamCache.get(videoId);
			if (mem && !isStreamExpired(mem.url)) {
				return { ...mem, fromCache: true };
			}
		}
	}

	// 2. Try Tier 5: Direct Innertube Android Player API
	let stream = await resolveViaInnertubeDirect(videoId);

	// 3. Fallback to Tier 6: youtubei.js
	if (!stream || !stream.url) {
		stream = await resolveViaYoutubei(videoId);
	}

	if (!stream || !stream.url) {
		throw new Error(`Failed to resolve playable audio stream for videoId: ${videoId}`);
	}

	// 4. Save to cache
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
