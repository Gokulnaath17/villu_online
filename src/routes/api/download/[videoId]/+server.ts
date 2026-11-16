import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveStream } from '#lib/server/stream';
import { getBindings } from '#lib/server/cf';
import { isValidVideoId } from '#lib/server/db';
import { getSystemSetting } from '#lib/server/admin';

// Supported download formats and their content-type mappings
const FORMAT_CONFIGS: Record<string, { mime: string; ext: string }> = {
	m4a: { mime: 'audio/mp4', ext: 'm4a' },
	mp4: { mime: 'audio/mp4', ext: 'm4a' },
	webm: { mime: 'audio/webm', ext: 'webm' },
	opus: { mime: 'audio/ogg; codecs=opus', ext: 'opus' }
};

export const GET: RequestHandler = async ({ params, url, platform, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { videoId } = params;
	if (!isValidVideoId(videoId)) {
		throw error(400, 'Invalid videoId format');
	}

	const requestedFormat = (url.searchParams.get('format') || 'm4a').toLowerCase();
	const config = FORMAT_CONFIGS[requestedFormat] || FORMAT_CONFIGS['m4a'];

	const title = (url.searchParams.get('title') || videoId).slice(0, 200);
	const artist = (url.searchParams.get('artist') || 'Unknown Artist').slice(0, 200);

	const { DB, STREAM_CACHE, YOUTUBE_COOKIE } = getBindings(platform);
	const dbCookie = await getSystemSetting(DB, 'youtube_cookie');
	const effectiveCookie = YOUTUBE_COOKIE || dbCookie || undefined;

	try {
		const stream = await resolveStream(videoId, STREAM_CACHE, false, effectiveCookie);

		let upstreamRes = await fetch(stream.url, {
			headers: {
				'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
				Accept: '*/*'
			},
			redirect: 'follow'
		});

		if (!upstreamRes.ok) {
			const freshStream = await resolveStream(videoId, STREAM_CACHE, true, effectiveCookie);
			upstreamRes = await fetch(freshStream.url, {
				headers: {
					'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
					Accept: '*/*'
				},
				redirect: 'follow'
			});
			if (!upstreamRes.ok) {
				throw error(upstreamRes.status, 'Upstream stream unavailable');
			}
		}

		const headers = new Headers();
		headers.set('Content-Type', config.mime);

		const safeTitle = `${artist} - ${title}`.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 180);
		headers.set('Content-Disposition', `attachment; filename="${safeTitle}.${config.ext}"`);

		const contentLength = upstreamRes.headers.get('content-length');
		if (contentLength) {
			headers.set('Content-Length', contentLength);
		}

		headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
		headers.set('Cache-Control', 'private, no-store');

		return new Response(upstreamRes.body, {
			status: 200,
			headers
		});
	} catch (err: any) {
		console.error('Download proxy error:', err);
		throw error(500, err?.message || 'Failed to download audio');
	}
};
