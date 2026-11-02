import { Innertube } from 'youtubei.js/cf-worker';
import type { SongTrack } from '#lib/types';

// Ensure fetch is bound to globalThis in Workers isolate
if (typeof globalThis.fetch === 'function') {
	try {
		globalThis.fetch = globalThis.fetch.bind(globalThis);
	} catch {}
}

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

function parseSeconds(durStr?: string | number): number {
	if (typeof durStr === 'number') return durStr;
	if (!durStr) return 0;
	const parts = durStr.split(':').map((p) => parseInt(p, 10));
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	} else if (parts.length === 2) {
		return parts[0] * 60 + parts[1];
	} else if (parts.length === 1) {
		return parts[0];
	}
	return 0;
}

function getBestThumbnail(thumbnails: any, videoId: string): string {
	if (Array.isArray(thumbnails) && thumbnails.length > 0) {
		const last = thumbnails[thumbnails.length - 1];
		if (last?.url) return last.url;
	} else if (thumbnails?.url) {
		return thumbnails.url;
	}
	return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// In-memory cache for search queries and home picks
const searchCache = new Map<string, { data: SongTrack[]; expiresAt: number }>();
let homePicksCache: { data: { title: string; tracks: SongTrack[] }[]; expiresAt: number } | null = null;

export async function searchTracks(query: string): Promise<SongTrack[]> {
	if (!query.trim()) return [];

	const cacheKey = query.trim().toLowerCase();
	const cached = searchCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data;
	}

	const yt = await getInnertube();
	const results = await yt.music.search(query, { type: 'song' });

	const items = results.songs?.contents || results.contents || [];
	const tracks: SongTrack[] = [];

	for (const item of items) {
		const videoId = (item as any).id || (item as any).video_id;
		if (!videoId) continue;

		const title = (item as any).title?.toString() || 'Unknown Title';
		const artistsArr = (item as any).artists || [];
		const artist =
			artistsArr.map((a: any) => a.name).join(', ') ||
			(item as any).author?.name ||
			(item as any).author ||
			'Unknown Artist';

		const thumbnail = getBestThumbnail((item as any).thumbnails || (item as any).thumbnail, videoId);
		const duration =
			(item as any).duration?.seconds ?? parseSeconds((item as any).duration?.text);

		tracks.push({
			videoId,
			title,
			artist,
			thumbnail,
			duration,
			album: (item as any).album?.name
		});
	}

	// Cache for 30 minutes
	searchCache.set(cacheKey, { data: tracks, expiresAt: Date.now() + 30 * 60 * 1000 });
	return tracks;
}

export async function getRadioTracks(videoId: string): Promise<SongTrack[]> {
	if (!videoId) return [];
	const yt = await getInnertube();
	const upNext = await yt.music.getUpNext(videoId);

	const items = upNext?.contents || [];
	const tracks: SongTrack[] = [];

	for (const item of items) {
		const trackId = (item as any).video_id || (item as any).id || (item as any).endpoint?.payload?.videoId;
		if (!trackId || trackId === videoId) continue;

		const title = (item as any).title?.toString() || 'Unknown Title';
		const artistsArr = (item as any).artists || [];
		const artist =
			artistsArr.map((a: any) => a.name).join(', ') ||
			(item as any).author?.name ||
			(item as any).author ||
			'Unknown Artist';

		const thumbnail = getBestThumbnail((item as any).thumbnails || (item as any).thumbnail, trackId);
		const duration =
			(item as any).duration?.seconds ?? parseSeconds((item as any).duration?.text);

		tracks.push({
			videoId: trackId,
			title,
			artist,
			thumbnail,
			duration,
			album: (item as any).album?.name
		});
	}

	return tracks;
}

// Instant curated initial picks (0ms latency, zero cold-start delay)
const SEEDED_HOME_PICKS: { title: string; tracks: SongTrack[] }[] = [
	{
		title: 'Top Hits & Trending',
		tracks: [
			{
				videoId: 'IvIttRf7KFc',
				title: 'Kannae Kanmaniye',
				artist: 'A.R. Rahman',
				thumbnail: 'https://i.ytimg.com/vi/IvIttRf7KFc/hqdefault.jpg',
				duration: 338,
				album: 'Trending Tamil Hits'
			},
			{
				videoId: 'xYmGMqYxtac',
				title: 'Marachipomanna',
				artist: 'A.R. Rahman',
				thumbnail: 'https://i.ytimg.com/vi/xYmGMqYxtac/hqdefault.jpg',
				duration: 259,
				album: 'Melody Hits'
			},
			{
				videoId: 'DsjRNPrvq6U',
				title: 'Hukum - Thalaivar Alappara',
				artist: 'Anirudh Ravichander',
				thumbnail: 'https://i.ytimg.com/vi/DsjRNPrvq6U/hqdefault.jpg',
				duration: 208,
				album: 'Jailer'
			},
			{
				videoId: '_pEI3p2EuR8',
				title: 'Naa Ready',
				artist: 'Anirudh Ravichander, Thalapathy Vijay',
				thumbnail: 'https://i.ytimg.com/vi/_pEI3p2EuR8/hqdefault.jpg',
				duration: 249,
				album: 'Leo'
			},
			{
				videoId: '8VEqzGViPrc',
				title: 'Badass',
				artist: 'Anirudh Ravichander',
				thumbnail: 'https://i.ytimg.com/vi/8VEqzGViPrc/hqdefault.jpg',
				duration: 230,
				album: 'Leo'
			},
			{
				videoId: 'nZiJTYiujUs',
				title: 'Chuttamalle',
				artist: 'Anirudh Ravichander, Shilpa Rao',
				thumbnail: 'https://i.ytimg.com/vi/nZiJTYiujUs/hqdefault.jpg',
				duration: 223,
				album: 'Devara'
			}
		]
	},
	{
		title: 'Melody & Soul',
		tracks: [
			{
				videoId: 'dQw4w9WgXcQ',
				title: 'Never Gonna Give You Up',
				artist: 'Rick Astley',
				thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
				duration: 213,
				album: 'Whenever You Need Somebody'
			},
			{
				videoId: 'OaiOf0-kISM',
				title: 'Al Rahman',
				artist: 'Abdel Rahman el Ousi',
				thumbnail: 'https://i.ytimg.com/vi/OaiOf0-kISM/hqdefault.jpg',
				duration: 707,
				album: 'Quranic Recitations'
			},
			{
				videoId: '_fmA1RoHbzA',
				title: 'Kun Faya Kun',
				artist: 'A.R. Rahman, Javed Ali, Mohit Chauhan',
				thumbnail: 'https://i.ytimg.com/vi/_fmA1RoHbzA/hqdefault.jpg',
				duration: 471,
				album: 'Rockstar'
			},
			{
				videoId: 'sK7riqg2mr4',
				title: 'Agar Tum Saath Ho',
				artist: 'Alka Yagnik, Arijit Singh',
				thumbnail: 'https://i.ytimg.com/vi/sK7riqg2mr4/hqdefault.jpg',
				duration: 341,
				album: 'Tamasha'
			},
			{
				videoId: '8dlTXzaP_8Q',
				title: 'Enna Sona',
				artist: 'A.R. Rahman, Arijit Singh',
				thumbnail: 'https://i.ytimg.com/vi/8dlTXzaP_8Q/hqdefault.jpg',
				duration: 213,
				album: 'OK Jaanu'
			}
		]
	},
	{
		title: 'Chill & Acoustic',
		tracks: [
			{
				videoId: 'NJAv_7lHUIU',
				title: 'Kesariya',
				artist: 'Pritam, Arijit Singh',
				thumbnail: 'https://i.ytimg.com/vi/NJAv_7lHUIU/hqdefault.jpg',
				duration: 269,
				album: 'Brahmastra'
			},
			{
				videoId: 'ElZfdU54Cp8',
				title: 'Apna Bana Le',
				artist: 'Arijit Singh, Sachin-Jigar',
				thumbnail: 'https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg',
				duration: 261,
				album: 'Bhediya'
			},
			{
				videoId: 'gvyUuxdRdR4',
				title: 'Raataan Lambiyan',
				artist: 'Tanishk Bagchi, Jubin Nautiyal',
				thumbnail: 'https://i.ytimg.com/vi/gvyUuxdRdR4/hqdefault.jpg',
				duration: 230,
				album: 'Shershaah'
			}
		]
	}
];

export async function getHomePicks(kv?: KVNamespace): Promise<{ title: string; tracks: SongTrack[] }[]> {
	// 1. Check in-memory cache (0ms)
	if (homePicksCache && homePicksCache.expiresAt > Date.now()) {
		return homePicksCache.data;
	}

	// 2. Check KV cache
	if (kv) {
		try {
			const kvVal = await kv.get('home_picks_v1');
			if (kvVal) {
				const parsed = JSON.parse(kvVal);
				homePicksCache = { data: parsed, expiresAt: Date.now() + 6 * 3600 * 1000 };
				return parsed;
			}
		} catch (err) {
			console.warn('KV read home_picks error:', err);
		}
	}

	// 3. Immediately return pre-seeded list for instant 0ms home page render!
	// In the background, refresh from YouTube and store into cache
	const initialData = SEEDED_HOME_PICKS;

	// Populate in-memory cache immediately so repeat calls are instant
	homePicksCache = { data: initialData, expiresAt: Date.now() + 60 * 1000 };

	// Asynchronously fetch fresh data in background without blocking response
	(async () => {
		try {
			const queries = [
				{ title: 'Top Hits & Trending', query: 'Top Tamil Hits 2026' },
				{ title: 'Melody & Soul', query: 'Anirudh AR Rahman Melody Hits' },
				{ title: 'Chill & Acoustic', query: 'Acoustic Pop Indie Hits' }
			];
			const fresh = await Promise.allSettled(
				queries.map(async (q) => ({
					title: q.title,
					tracks: (await searchTracks(q.query)).slice(0, 10)
				}))
			);
			const valid = fresh
				.filter((r): r is PromiseFulfilledResult<{ title: string; tracks: SongTrack[] }> => r.status === 'fulfilled' && r.value.tracks.length > 0)
				.map((r) => r.value);

			if (valid.length > 0) {
				homePicksCache = { data: valid, expiresAt: Date.now() + 6 * 3600 * 1000 };
				if (kv) {
					await kv.put('home_picks_v1', JSON.stringify(valid), { expirationTtl: 21600 });
				}
			}
		} catch (err) {
			console.warn('Background home refresh error:', err);
		}
	})();

	return initialData;
}
