import type { SongTrack } from '#lib/types';

// In-memory cache for search queries, radio, and home picks
const searchCache = new Map<string, { data: SongTrack[]; expiresAt: number }>();
const radioCache = new Map<string, { data: SongTrack[]; expiresAt: number }>();
let homePicksCache: { data: { title: string; tracks: SongTrack[] }[]; expiresAt: number } | null = null;

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
		if (last?.url) {
			return last.url.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj');
		}
	} else if (thumbnails?.url) {
		return thumbnails.url;
	}
	return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * YouTube Music (WEB_REMIX) song search
 * Fast, pure HTTP fetch with zero heavy dependencies or CPU limits
 */
async function searchMusicYTM(query: string): Promise<SongTrack[]> {
	try {
		const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Origin: 'https://music.youtube.com',
				Referer: 'https://music.youtube.com/'
			},
			body: JSON.stringify({
				context: {
					client: {
						clientName: 'WEB_REMIX',
						clientVersion: '1.20231215.01.00',
						hl: 'en'
					}
				},
				query,
				params: 'EgWKAQIIAWoSEAQQAxAJEAUQChAVEBAQDhAR' // Filter by songs
			})
		});

		if (!res.ok) return [];
		const data = (await res.json()) as any;
		const sectionList =
			data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
				?.sectionListRenderer?.contents || [];
		const tracks: SongTrack[] = [];

		for (const s of sectionList) {
			const shelf = s.musicShelfRenderer;
			if (!shelf || !shelf.contents) continue;

			for (const item of shelf.contents) {
				const r = item.musicResponsiveListItemRenderer;
				if (!r) continue;

				const videoId =
					r.playlistItemData?.videoId ||
					r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
						?.playNavigationEndpoint?.watchEndpoint?.videoId ||
					r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
						?.navigationEndpoint?.watchEndpoint?.videoId;

				if (!videoId) continue;

				const title =
					r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
					'Unknown Title';

				const col1Runs: any[] =
					r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
				const bulletIndices: number[] = [];
				col1Runs.forEach((run, idx) => {
					if (run.text && run.text.trim() === '•') bulletIndices.push(idx);
				});

				let artist = '';
				let album: string | undefined = undefined;
				let durationStr = '';

				if (bulletIndices.length === 0) {
					artist = col1Runs.map((x) => x.text).join('').trim() || 'Unknown Artist';
				} else if (bulletIndices.length === 1) {
					artist =
						col1Runs
							.slice(0, bulletIndices[0])
							.map((x) => x.text)
							.join('')
							.trim() || 'Unknown Artist';
					const secondPart = col1Runs
						.slice(bulletIndices[0] + 1)
						.map((x) => x.text)
						.join('')
						.trim();
					if (/^\d+:\d+$/.test(secondPart)) {
						durationStr = secondPart;
					} else {
						album = secondPart;
					}
				} else {
					artist =
						col1Runs
							.slice(0, bulletIndices[0])
							.map((x) => x.text)
							.join('')
							.trim() || 'Unknown Artist';
					album = col1Runs
						.slice(bulletIndices[0] + 1, bulletIndices[1])
						.map((x) => x.text)
						.join('')
						.trim();
					durationStr = col1Runs
						.slice(bulletIndices[bulletIndices.length - 1] + 1)
						.map((x) => x.text)
						.join('')
						.trim();
				}

				if (!durationStr && r.fixedColumns?.[0]) {
					durationStr =
						r.fixedColumns[0].musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]
							?.text || '';
				}

				const thumbnail = getBestThumbnail(
					r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails,
					videoId
				);
				const duration = parseSeconds(durationStr);

				tracks.push({
					videoId,
					title,
					artist,
					album,
					thumbnail,
					duration
				});
			}
		}
		return tracks;
	} catch (err) {
		console.warn('YTM search error:', err);
		return [];
	}
}

/**
 * YouTube Android client fallback search
 */
async function searchYouTubeAndroid(query: string): Promise<SongTrack[]> {
	try {
		const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
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
						gl: 'US'
					}
				},
				query
			})
		});

		if (!res.ok) return [];
		const data = (await res.json()) as any;
		const sections = data.contents?.sectionListRenderer?.contents || [];
		const tracks: SongTrack[] = [];

		for (const s of sections) {
			const items = s.itemSectionRenderer?.contents || [];
			for (const item of items) {
				const v = item.compactVideoRenderer || item.videoRenderer;
				if (!v || !v.videoId) continue;

				const title = v.title?.runs?.[0]?.text || 'Unknown Title';
				const artist =
					v.longBylineText?.runs?.[0]?.text ||
					v.shortBylineText?.runs?.[0]?.text ||
					'Unknown Artist';
				const durText = v.lengthText?.runs?.[0]?.text || v.lengthText?.simpleText;
				const duration = parseSeconds(durText);
				const thumbnail = getBestThumbnail(v.thumbnail?.thumbnails, v.videoId);

				tracks.push({
					videoId: v.videoId,
					title,
					artist,
					thumbnail,
					duration
				});
			}
		}
		return tracks;
	} catch (err) {
		console.warn('Android search error:', err);
		return [];
	}
}

/**
 * Main search function with multi-tier caching (In-Memory + KV)
 */
export async function searchTracks(query: string, kv?: KVNamespace): Promise<SongTrack[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const cacheKey = trimmed.toLowerCase();

	// 1. Check in-memory cache
	const cached = searchCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data;
	}

	// 2. Check KV cache if available
	if (kv) {
		try {
			const kvVal = await kv.get(`search:${cacheKey}`);
			if (kvVal) {
				const parsed = JSON.parse(kvVal) as SongTrack[];
				searchCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + 30 * 60 * 1000 });
				return parsed;
			}
		} catch (err) {
			console.warn('KV search read error:', err);
		}
	}

	// 3. Search YouTube Music first, fallback to YouTube Android
	let tracks = await searchMusicYTM(trimmed);
	if (tracks.length === 0) {
		tracks = await searchYouTubeAndroid(trimmed);
	}

	// 4. Cache results
	if (tracks.length > 0) {
		searchCache.set(cacheKey, { data: tracks, expiresAt: Date.now() + 30 * 60 * 1000 });
		if (kv) {
			try {
				await kv.put(`search:${cacheKey}`, JSON.stringify(tracks), { expirationTtl: 7200 });
			} catch (err) {
				console.warn('KV search write error:', err);
			}
		}
	}

	return tracks;
}

/**
 * YouTube Music radio / up-next track recommendations
 */
export async function getRadioTracks(videoId: string, kv?: KVNamespace): Promise<SongTrack[]> {
	if (!videoId) return [];

	// 1. In-memory cache
	const cached = radioCache.get(videoId);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data;
	}

	// 2. KV cache
	if (kv) {
		try {
			const kvVal = await kv.get(`radio:${videoId}`);
			if (kvVal) {
				const parsed = JSON.parse(kvVal) as SongTrack[];
				radioCache.set(videoId, { data: parsed, expiresAt: Date.now() + 60 * 60 * 1000 });
				return parsed;
			}
		} catch (err) {
			console.warn('KV radio read error:', err);
		}
	}

	try {
		const res = await fetch('https://music.youtube.com/youtubei/v1/next?prettyPrint=false', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Origin: 'https://music.youtube.com',
				Referer: 'https://music.youtube.com/'
			},
			body: JSON.stringify({
				context: {
					client: {
						clientName: 'WEB_REMIX',
						clientVersion: '1.20231215.01.00',
						hl: 'en'
					}
				},
				playlistId: `RDAMVM${videoId}`,
				videoId
			})
		});

		if (!res.ok) return [];
		const data = (await res.json()) as any;
		const queue =
			data.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
				?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer;
		const panel = queue?.content?.playlistPanelRenderer;
		const items = panel?.contents || [];
		const tracks: SongTrack[] = [];

		for (const item of items) {
			const v = item.playlistPanelVideoRenderer;
			if (!v || !v.videoId || v.videoId === videoId) continue;

			const title = v.title?.runs?.[0]?.text || 'Unknown Title';
			const artist =
				v.shortBylineText?.runs?.map((r: any) => r.text).join('') || 'Unknown Artist';
			const durText = v.lengthText?.runs?.[0]?.text;
			const duration = parseSeconds(durText);
			const thumbnail = getBestThumbnail(v.thumbnail?.thumbnails, v.videoId);

			let album: string | undefined = undefined;
			const longRuns: any[] = v.longBylineText?.runs || [];
			const bulletIdx = longRuns.findIndex((r) => r.text && r.text.includes('•'));
			if (bulletIdx !== -1 && longRuns[bulletIdx + 1]?.text) {
				album = longRuns[bulletIdx + 1].text.trim();
			}

			tracks.push({
				videoId: v.videoId,
				title,
				artist,
				album,
				thumbnail,
				duration
			});
		}

		if (tracks.length > 0) {
			radioCache.set(videoId, { data: tracks, expiresAt: Date.now() + 60 * 60 * 1000 });
			if (kv) {
				try {
					await kv.put(`radio:${videoId}`, JSON.stringify(tracks), { expirationTtl: 86400 });
				} catch (err) {
					console.warn('KV radio write error:', err);
				}
			}
		}

		return tracks;
	} catch (err) {
		console.warn('Radio fetch error:', err);
		return [];
	}
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

export async function getHomePicks(
	kv?: KVNamespace
): Promise<{ title: string; tracks: SongTrack[] }[]> {
	// 1. In-memory cache (0ms)
	if (homePicksCache && homePicksCache.expiresAt > Date.now()) {
		return homePicksCache.data;
	}

	// 2. KV cache
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

	// 3. Fall back to curated pre-seeded list for instant render
	return SEEDED_HOME_PICKS;
}
