import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveStream } from '#lib/server/stream';
import { getBindings } from '#lib/server/cf';
import { isValidVideoId } from '#lib/server/db';
import { getSystemSetting } from '#lib/server/admin';

export const GET: RequestHandler = async ({ params, platform, url, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { videoId } = params;
	if (!isValidVideoId(videoId)) {
		throw error(400, 'Invalid videoId format');
	}

	const forceRefresh = url.searchParams.get('refresh') === 'true';
	const { DB, STREAM_CACHE, YOUTUBE_COOKIE } = getBindings(platform);
	const dbCookie = await getSystemSetting(DB, 'youtube_cookie');
	const effectiveCookie = YOUTUBE_COOKIE || dbCookie || undefined;

	try {
		const stream = await resolveStream(videoId, STREAM_CACHE, forceRefresh, effectiveCookie);
		return json(stream, {
			headers: {
				'Cache-Control': 'private, max-age=14400'
			}
		});
	} catch (err: any) {
		console.error(`Error resolving stream for ${videoId}:`, err);
		throw error(500, err?.message || 'Failed to resolve stream');
	}
};
