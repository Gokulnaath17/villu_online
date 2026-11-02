import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveStream } from '#lib/server/stream';
import { getBindings } from '#lib/server/cf';
import { isValidVideoId } from '#lib/server/db';

export const GET: RequestHandler = async ({ params, platform, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { videoId } = params;
	if (!isValidVideoId(videoId)) {
		throw error(400, 'Invalid videoId format');
	}

	const { STREAM_CACHE } = getBindings(platform);
	try {
		const stream = await resolveStream(videoId, STREAM_CACHE);

		// Extract Range header from browser request (crucial for <audio> elements)
		const range = request.headers.get('range') || 'bytes=0-';

		const upstreamHeaders: Record<string, string> = {
			'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
			'Accept': '*/*',
			'Range': range
		};

		const upstreamRes = await fetch(stream.url, {
			headers: upstreamHeaders,
			redirect: 'follow'
		});

		if (!upstreamRes.ok && upstreamRes.status !== 206) {
			console.warn(`Upstream audio fetch status: ${upstreamRes.status} for ${videoId}`);
			// If upstream returned error (e.g. 403 expired), retry with fresh stream resolution
			const freshStream = await resolveStream(videoId, STREAM_CACHE, true);
			const retryRes = await fetch(freshStream.url, {
				headers: upstreamHeaders,
				redirect: 'follow'
			});
			if (!retryRes.ok && retryRes.status !== 206) {
				throw error(retryRes.status, 'Upstream stream unavailable');
			}
			return makeAudioResponse(retryRes);
		}

		return makeAudioResponse(upstreamRes);
	} catch (err: any) {
		console.error('Audio stream proxy error:', err);
		throw error(500, err?.message || 'Failed to stream audio');
	}
};

function makeAudioResponse(res: Response): Response {
	const headers = new Headers();
	let contentType = res.headers.get('content-type') || 'audio/mp4';
	if (contentType.startsWith('video/')) {
		contentType = 'audio/mp4';
	}
	headers.set('Content-Type', contentType);
	headers.set('Accept-Ranges', 'bytes');
	headers.set('Cache-Control', 'private, max-age=14400');

	const contentRange = res.headers.get('content-range');
	if (contentRange) {
		headers.set('Content-Range', contentRange);
	}

	const contentLength = res.headers.get('content-length');
	if (contentLength) {
		headers.set('Content-Length', contentLength);
	}

	return new Response(res.body, {
		status: res.status,
		headers
	});
}
