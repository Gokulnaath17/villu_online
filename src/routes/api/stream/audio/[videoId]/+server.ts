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

	const { STREAM_CACHE, YOUTUBE_COOKIE } = getBindings(platform);
	try {
		const stream = await resolveStream(videoId, STREAM_CACHE, false, YOUTUBE_COOKIE);

		// Only forward Range header if client actually requested one
		const clientRange = request.headers.get('range');

		const upstreamHeaders: Record<string, string> = {
			'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
			'Accept': '*/*'
		};
		if (clientRange) {
			upstreamHeaders['Range'] = clientRange;
		}

		let upstreamRes = await fetch(stream.url, {
			headers: upstreamHeaders,
			redirect: 'follow'
		});

		if (!upstreamRes.ok) {
			console.warn(`Upstream audio fetch status: ${upstreamRes.status} for ${videoId}, retrying fresh...`);
			// If upstream returned error (e.g. 403 expired), retry with fresh stream resolution
			const freshStream = await resolveStream(videoId, STREAM_CACHE, true, YOUTUBE_COOKIE);
			upstreamRes = await fetch(freshStream.url, {
				headers: upstreamHeaders,
				redirect: 'follow'
			});
			if (!upstreamRes.ok) {
				throw error(upstreamRes.status, 'Upstream stream unavailable');
			}
		}

		return makeAudioResponse(upstreamRes, clientRange);
	} catch (err: any) {
		console.error('Audio stream proxy error:', err);
		throw error(500, err?.message || 'Failed to stream audio');
	}
};

function makeAudioResponse(res: Response, requestedRange: string | null): Response {
	const headers = new Headers();
	// Preserve upstream content-type so browser media demuxers handle container formats accurately
	const contentType = res.headers.get('content-type') || 'video/mp4';
	headers.set('Content-Type', contentType);
	headers.set('Accept-Ranges', 'bytes');
	headers.set('Cache-Control', 'private, max-age=14400');

	const contentRange = res.headers.get('content-range');
	if (contentRange && requestedRange) {
		headers.set('Content-Range', contentRange);
	}

	const contentLength = res.headers.get('content-length');
	if (contentLength) {
		headers.set('Content-Length', contentLength);
	}

	// Status code MUST be 206 only if range was requested by client; otherwise 200
	let status = res.status;
	if (!requestedRange && status === 206) {
		status = 200;
	}

	return new Response(res.body, {
		status,
		headers
	});
}
