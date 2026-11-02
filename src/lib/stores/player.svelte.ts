import { AudioEngine } from '#lib/audio/engine';
import { MediaSessionManager } from '#lib/audio/media-session';
import { queueStore } from '#lib/stores/queue.svelte';
import type { SongTrack, StreamData } from '#lib/types';

class PlayerStore {
	private engine: AudioEngine | null = null;
	private mediaSession: MediaSessionManager | null = null;

	private _isPlaying = $state<boolean>(false);
	private _isLoading = $state<boolean>(false);
	private _position = $state<number>(0);
	private _duration = $state<number>(0);
	private _volume = $state<number>(1.0);
	private _isMuted = $state<boolean>(false);
	private _isExpanded = $state<boolean>(false);
	private _isQueueOpen = $state<boolean>(false);
	private _errorMessage = $state<string | null>(null);

	// Concurrency & Race-condition token (as per MECHANISM.md §5.1)
	private _currentRequestId = 0;
	private _isInitialized = false;

	public get isPlaying(): boolean {
		return this._isPlaying;
	}
	public get isLoading(): boolean {
		return this._isLoading;
	}
	public get position(): number {
		return this._position;
	}
	public get duration(): number {
		return this._duration;
	}
	public get volume(): number {
		return this._volume;
	}
	public get isMuted(): boolean {
		return this._isMuted;
	}
	public get isExpanded(): boolean {
		return this._isExpanded;
	}
	public get isQueueOpen(): boolean {
		return this._isQueueOpen;
	}
	public get errorMessage(): string | null {
		return this._errorMessage;
	}
	public get currentTrack(): SongTrack | null {
		return queueStore.currentTrack;
	}

	public init() {
		if (this._isInitialized || typeof window === 'undefined') return;
		this._isInitialized = true;

		this.engine = new AudioEngine({
			onTimeUpdate: (pos, dur) => {
				this._position = pos;
				// True decoded duration patching (MECHANISM.md §5.5)
				if (dur > 0 && Math.abs(this._duration - dur) > 1) {
					this._duration = dur;
				}
				this.mediaSession?.updatePositionState(this._duration, pos);
			},
			onEnded: () => {
				this.handleTrackEnded();
			},
			onLoading: (loading) => {
				this._isLoading = loading;
			},
			onError: (err) => {
				console.warn('Audio playback error:', err);
				this.handlePlaybackError(err);
			},
			onPreloadNeeded: () => {
				this.preloadNextTrack();
			}
		});

		this.mediaSession = new MediaSessionManager({
			onPlay: () => this.resume(),
			onPause: () => this.pause(),
			onNext: () => this.skipNext(),
			onPrevious: () => this.skipPrevious(),
			onSeek: (pos) => {
				if (pos < 0) {
					this.seek(this._position + pos);
				} else {
					this.seek(pos);
				}
			}
		});

		// Load saved volume
		try {
			const savedVol = localStorage.getItem('villu_volume');
			if (savedVol !== null) {
				const v = parseFloat(savedVol);
				if (!isNaN(v)) {
					this._volume = v;
					this.engine.setVolume(v);
				}
			}
		} catch {}

		// Restore previous session
		this.restoreSession();

		// Save session on page unload
		window.addEventListener('beforeunload', () => {
			this.saveSession();
		});
	}

	public async playTrack(track: SongTrack, queueContext?: SongTrack[], startIndex?: number) {
		this.init();
		if (queueContext && queueContext.length > 0) {
			const idx = startIndex !== undefined ? startIndex : queueContext.findIndex((t) => t.videoId === track.videoId);
			queueStore.setTracks(queueContext, Math.max(0, idx));
		} else {
			queueStore.setTracks([track], 0);
		}

		await this.loadAndPlay(track);

		// If queue has only 1 track, trigger radio continuation (MECHANISM.md §6.2)
		if (queueStore.tracks.length === 1) {
			this.triggerRadioContinuation(track.videoId);
		}
	}

	public async playIndex(index: number) {
		this.init();
		queueStore.setIndex(index);
		const track = queueStore.currentTrack;
		if (track) {
			await this.loadAndPlay(track);
		}
	}

	private async loadAndPlay(track: SongTrack, forceRefresh = false, startPos = 0) {
		const reqId = ++this._currentRequestId;
		this._isLoading = true;
		this._errorMessage = null;

		// Set optimistic metadata
		this._position = startPos;
		this._duration = track.duration || 0;
		this.mediaSession?.updateMetadata(track);

		// Use the robust proxied audio stream route (guarantees universal browser playback without CORS or IP blocks)
		const audioProxyUrl = `/api/stream/audio/${track.videoId}`;

		try {
			await this.engine?.playUrl(track.videoId, audioProxyUrl, startPos);

			if (reqId !== this._currentRequestId) return;

			this._isPlaying = true;
			this._isLoading = false;
			this.mediaSession?.updatePlaybackState(true);

			// Record history in background
			this.recordHistory(track);
		} catch (err: any) {
			if (reqId !== this._currentRequestId) return;
			console.error('Play error:', err);
			this._isLoading = false;
			this._isPlaying = false;
			this._errorMessage = err.message || 'Stream playback failed';
		}
	}

	private preloadNextTrack() {
		const next = queueStore.nextTrack;
		if (!next || !this.engine) return;

		const nextAudioUrl = `/api/stream/audio/${next.videoId}`;
		this.engine.preloadNext(next.videoId, nextAudioUrl);
	}

	private async triggerRadioContinuation(videoId: string) {
		try {
			const res = await fetch(`/api/radio/${videoId}`);
			if (res.ok) {
				const tracks = (await res.json()) as SongTrack[];
				if (tracks.length > 0 && queueStore.tracks.length <= 1) {
					queueStore.addBatch(tracks);
				}
			}
		} catch (err) {
			console.warn('Radio continuation failed:', err);
		}
	}

	public async togglePlay() {
		this.init();
		if (this._isPlaying) {
			this.pause();
		} else {
			if (this.currentTrack) {
				if (this.engine?.position && this.engine.position > 0) {
					await this.resume();
				} else {
					await this.loadAndPlay(this.currentTrack, false, this._position);
				}
			} else if (queueStore.tracks.length > 0) {
				await this.playIndex(0);
			}
		}
	}

	public pause() {
		this.engine?.pause();
		this._isPlaying = false;
		this.mediaSession?.updatePlaybackState(false);
	}

	public async resume() {
		try {
			await this.engine?.resume();
			this._isPlaying = true;
			this.mediaSession?.updatePlaybackState(true);
		} catch (err) {
			if (this.currentTrack) {
				await this.loadAndPlay(this.currentTrack, false, this._position);
			}
		}
	}

	public seek(posSeconds: number) {
		this._position = posSeconds;
		this.engine?.seek(posSeconds);
		this.mediaSession?.updatePositionState(this._duration, posSeconds);
	}

	public async skipNext() {
		const nextIdx = queueStore.peekNextIndex();
		if (nextIdx !== null) {
			await this.playIndex(nextIdx);
		} else {
			this.pause();
			this.seek(0);
		}
	}

	/**
	 * Smart Skip-to-Previous (as detailed in MECHANISM.md §6.2)
	 * If played > 3 seconds, reset to 0; else skip to previous track
	 */
	public async skipPrevious() {
		if (this._position > 3) {
			this.seek(0);
		} else {
			const prevIdx = queueStore.peekPrevIndex();
			if (prevIdx !== null) {
				await this.playIndex(prevIdx);
			} else {
				this.seek(0);
			}
		}
	}

	public setVolume(vol: number) {
		this._volume = Math.max(0, Math.min(1, vol));
		this.engine?.setVolume(this._volume);
		try {
			localStorage.setItem('villu_volume', this._volume.toString());
		} catch {}
	}

	public toggleMute() {
		this._isMuted = !this._isMuted;
		this.engine?.setMuted(this._isMuted);
	}

	public toggleExpand() {
		this._isExpanded = !this._isExpanded;
	}

	public setExpanded(expanded: boolean) {
		this._isExpanded = expanded;
	}

	public toggleQueue() {
		this._isQueueOpen = !this._isQueueOpen;
	}

	public setQueueOpen(open: boolean) {
		this._isQueueOpen = open;
	}

	private handleTrackEnded() {
		if (queueStore.loopMode === 'one') {
			this.seek(0);
			this.resume();
			return;
		}
		this.skipNext();
	}

	private handlePlaybackError(errorMsg: string) {
		this._isLoading = false;
		this._isPlaying = false;
		this._errorMessage = errorMsg || 'Audio stream unavailable';
	}

	private async recordHistory(track: SongTrack) {
		try {
			await fetch('/api/library/history', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ track })
			});
		} catch (err) {
			// Non-blocking
		}
	}

	public saveSession() {
		try {
			const session = {
				tracks: queueStore.tracks.slice(0, 100),
				currentIndex: queueStore.currentIndex,
				position: Math.floor(this._position),
				loopMode: queueStore.loopMode,
				isShuffle: queueStore.isShuffle
			};
			localStorage.setItem('villu_prev_session', JSON.stringify(session));
		} catch {}
	}

	public restoreSession() {
		try {
			const raw = localStorage.getItem('villu_prev_session');
			if (!raw) return;
			const data = JSON.parse(raw);
			if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
				queueStore.setTracks(data.tracks, data.currentIndex || 0);
				this._position = data.position || 0;
				const current = queueStore.currentTrack;
				if (current) {
					this._duration = current.duration || 0;
					this.mediaSession?.updateMetadata(current);
				}
			}
		} catch {}
	}
}

export const playerStore = new PlayerStore();
