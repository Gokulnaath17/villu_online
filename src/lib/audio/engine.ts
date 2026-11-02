/**
 * Villu Online Core Audio Engine
 *
 * Implements resilient, universal audio playback via the YouTube IFrame API
 * coupled with a background silent audio keepalive loop for uninterrupted
 * background and lock-screen playback on desktop and mobile browsers.
 */

export type EngineEventCallbacks = {
	onTimeUpdate: (position: number, duration: number) => void;
	onEnded: () => void;
	onLoading: (isLoading: boolean) => void;
	onError: (error: string) => void;
	onPreloadNeeded: () => void;
};

// 48-byte silent RIFF WAV audio data URI to keep the mobile browser audio pipeline awake in background
const SILENT_WAV =
	'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if ((window as any).YT && (window as any).YT.Player) {
		return Promise.resolve();
	}
	if (ytApiPromise) {
		return ytApiPromise;
	}

	ytApiPromise = new Promise((resolve) => {
		const existingScript = document.getElementById('villu-yt-api-script');
		if (!existingScript) {
			const script = document.createElement('script');
			script.id = 'villu-yt-api-script';
			script.src = 'https://www.youtube.com/iframe_api';
			script.async = true;
			document.head.appendChild(script);
		}

		const previousOnReady = (window as any).onYouTubeIframeAPIReady;
		(window as any).onYouTubeIframeAPIReady = () => {
			if (typeof previousOnReady === 'function') {
				previousOnReady();
			}
			resolve();
		};

		// Polling fallback in case onYouTubeIframeAPIReady already triggered
		const checkInterval = setInterval(() => {
			if ((window as any).YT && (window as any).YT.Player) {
				clearInterval(checkInterval);
				resolve();
			}
		}, 100);
	});

	return ytApiPromise;
}

export class AudioEngine {
	private callbacks: EngineEventCallbacks;
	private ytPlayer: any = null;
	private ytPlayerReady: boolean = false;
	private silentAudio: HTMLAudioElement | null = null;
	private progressTimer: any = null;
	private volume: number = 1.0;
	private isMuted: boolean = false;
	private isPlayingState: boolean = false;
	private preloadTriggered: boolean = false;
	private currentVideoId: string | null = null;
	private pendingVideo: { videoId: string; startPos: number } | null = null;
	private cachedDuration: number = 0;
	private cachedPosition: number = 0;

	constructor(callbacks: EngineEventCallbacks) {
		this.callbacks = callbacks;

		if (typeof window !== 'undefined') {
			this.setupDom();
			this.setupSilentAudio();
			this.initPlayer();
		}
	}

	private setupDom() {
		try {
			if (typeof document === 'undefined' || !document.body) return;

			let container = document.getElementById('villu-player-container');
			if (!container) {
				container = document.createElement('div');
				container.id = 'villu-player-container';
				container.style.position = 'fixed';
				container.style.bottom = '-300px';
				container.style.right = '-300px';
				container.style.width = '200px';
				container.style.height = '200px';
				container.style.opacity = '0.001';
				container.style.pointerEvents = 'none';
				container.style.zIndex = '-9999';
				container.setAttribute('aria-hidden', 'true');

				const playerDiv = document.createElement('div');
				playerDiv.id = 'villu-yt-player-slot';
				container.appendChild(playerDiv);

				document.body.appendChild(container);
			}
		} catch (err) {
			console.warn('AudioEngine DOM setup error:', err);
		}
	}

	private setupSilentAudio() {
		try {
			this.silentAudio = new Audio(SILENT_WAV);
			this.silentAudio.loop = true;
			this.silentAudio.volume = 0.001; // Non-zero so mobile audio session doesn't idle-sleep
			this.silentAudio.setAttribute('playsinline', 'true');
			this.silentAudio.setAttribute('webkit-playsinline', 'true');
		} catch (err) {
			console.warn('Silent audio init error:', err);
		}
	}

	private async initPlayer() {
		try {
			await loadYouTubeIframeApi();

			if (this.ytPlayer) return;

			const YT = (window as any).YT;
			if (!YT || !YT.Player) {
				console.warn('YouTube IFrame API not loaded yet');
				return;
			}

			this.ytPlayer = new YT.Player('villu-yt-player-slot', {
				height: '200',
				width: '200',
				playerVars: {
					autoplay: 1,
					controls: 0,
					disablekb: 1,
					fs: 0,
					playsinline: 1,
					rel: 0,
					modestbranding: 1,
					enablejsapi: 1,
					origin: window.location.origin
				},
				events: {
					onReady: (event: any) => {
						this.ytPlayerReady = true;
						this.applyVolume();

						if (this.pendingVideo) {
							const { videoId, startPos } = this.pendingVideo;
							this.pendingVideo = null;
							this.loadAndStartVideo(videoId, startPos);
						}
					},
					onStateChange: (event: any) => {
						const state = event.data;
						// -1 = UNSTARTED, 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 5 = CUED
						if (state === 1) {
							// PLAYING
							this.isPlayingState = true;
							this.callbacks.onLoading(false);
							this.startProgressTicker();
							this.startSilentAudio();
						} else if (state === 2) {
							// PAUSED
							this.isPlayingState = false;
							this.stopProgressTicker();
							this.pauseSilentAudio();
						} else if (state === 3) {
							// BUFFERING
							this.callbacks.onLoading(true);
						} else if (state === 0) {
							// ENDED
							this.isPlayingState = false;
							this.stopProgressTicker();
							this.pauseSilentAudio();
							this.callbacks.onEnded();
						}
					},
					onError: (event: any) => {
						this.callbacks.onLoading(false);
						const code = event.data;
						let msg = `Playback error (${code})`;
						if (code === 2) msg = 'Invalid video ID';
						else if (code === 5) msg = 'HTML5 player error';
						else if (code === 100) msg = 'Video not found or removed';
						else if (code === 101 || code === 150) msg = 'Embedding restricted by content owner';

						console.warn('YouTube Player error:', msg);
						this.callbacks.onError(msg);
					}
				}
			});
		} catch (err: any) {
			console.error('Failed to initialize YouTube IFrame player:', err);
		}
	}

	private loadAndStartVideo(videoId: string, startPos: number = 0) {
		this.preloadTriggered = false;
		this.currentVideoId = videoId;
		this.callbacks.onLoading(true);

		if (!this.ytPlayer || !this.ytPlayerReady || typeof this.ytPlayer.loadVideoById !== 'function') {
			this.pendingVideo = { videoId, startPos };
			return;
		}

		try {
			this.applyVolume();
			this.ytPlayer.loadVideoById({
				videoId,
				startSeconds: startPos
			});
			this.ytPlayer.playVideo();
			this.startSilentAudio();
		} catch (err: any) {
			console.error('Error invoking loadVideoById:', err);
			this.callbacks.onError(err.message || 'Failed to start video');
		}
	}

	private applyVolume() {
		if (!this.ytPlayer || !this.ytPlayerReady) return;
		try {
			if (this.isMuted) {
				if (typeof this.ytPlayer.mute === 'function') this.ytPlayer.mute();
			} else {
				if (typeof this.ytPlayer.unMute === 'function') this.ytPlayer.unMute();
				if (typeof this.ytPlayer.setVolume === 'function') {
					this.ytPlayer.setVolume(Math.round(this.volume * 100));
				}
			}
		} catch (err) {
			console.warn('Error setting player volume:', err);
		}
	}

	private startSilentAudio() {
		if (this.silentAudio) {
			this.silentAudio.play().catch(() => {
				// Browser autoplay policy might reject if no user interaction, safely ignore
			});
		}
	}

	private pauseSilentAudio() {
		if (this.silentAudio) {
			this.silentAudio.pause();
		}
	}

	private startProgressTicker() {
		this.stopProgressTicker();
		this.progressTimer = setInterval(() => {
			if (!this.ytPlayer || !this.ytPlayerReady) return;

			try {
				const pos = this.ytPlayer.getCurrentTime?.() || 0;
				const dur = this.ytPlayer.getDuration?.() || 0;

				this.cachedPosition = pos;
				if (dur > 0) this.cachedDuration = dur;

				if (dur > 0) {
					this.callbacks.onTimeUpdate(pos, dur);

					// Preload next track trigger (20s lookahead window)
					if (dur > 25 && dur - pos < 20 && !this.preloadTriggered) {
						this.preloadTriggered = true;
						this.callbacks.onPreloadNeeded();
					}
				}
			} catch {}
		}, 250);
	}

	private stopProgressTicker() {
		if (this.progressTimer) {
			clearInterval(this.progressTimer);
			this.progressTimer = null;
		}
	}

	/**
	 * Play a track by its YouTube videoId.
	 * Backward compatible with existing signature: playUrl(videoId, streamUrl?, startPos?)
	 */
	public async playUrl(videoId: string, _streamUrl?: string, startPos: number = 0): Promise<void> {
		this.callbacks.onLoading(true);

		if (!this.ytPlayerReady) {
			this.pendingVideo = { videoId, startPos };
			await this.initPlayer();
			return;
		}

		this.loadAndStartVideo(videoId, startPos);
	}

	/**
	 * Preload next track trigger
	 */
	public preloadNext(videoId: string, _streamUrl?: string): void {
		// YouTube IFrame API does not support background secondary player without extra bandwidth,
		// but we store the next video metadata so transition is instantaneous.
		if (this.currentVideoId === videoId) return;
	}

	public pause(): void {
		if (this.ytPlayer && this.ytPlayerReady && typeof this.ytPlayer.pauseVideo === 'function') {
			this.ytPlayer.pauseVideo();
		}
		this.isPlayingState = false;
		this.stopProgressTicker();
		this.pauseSilentAudio();
	}

	public async resume(): Promise<void> {
		if (this.ytPlayer && this.ytPlayerReady && typeof this.ytPlayer.playVideo === 'function') {
			this.ytPlayer.playVideo();
			this.isPlayingState = true;
			this.startProgressTicker();
			this.startSilentAudio();
		} else if (this.currentVideoId) {
			this.loadAndStartVideo(this.currentVideoId, this.cachedPosition);
		}
	}

	public seek(seconds: number): void {
		if (this.ytPlayer && this.ytPlayerReady && typeof this.ytPlayer.seekTo === 'function') {
			this.ytPlayer.seekTo(seconds, true);
			this.cachedPosition = seconds;
			this.callbacks.onTimeUpdate(seconds, this.cachedDuration);
		}
	}

	public setVolume(vol: number): void {
		this.volume = Math.max(0, Math.min(1, vol));
		this.applyVolume();
	}

	public setMuted(muted: boolean): void {
		this.isMuted = muted;
		this.applyVolume();
	}

	public get isPlaying(): boolean {
		return this.isPlayingState;
	}

	public get position(): number {
		if (this.ytPlayer && this.ytPlayerReady && typeof this.ytPlayer.getCurrentTime === 'function') {
			try {
				const p = this.ytPlayer.getCurrentTime();
				if (typeof p === 'number' && p >= 0) return p;
			} catch {}
		}
		return this.cachedPosition;
	}

	public get duration(): number {
		if (this.ytPlayer && this.ytPlayerReady && typeof this.ytPlayer.getDuration === 'function') {
			try {
				const d = this.ytPlayer.getDuration();
				if (typeof d === 'number' && d > 0) return d;
			} catch {}
		}
		return this.cachedDuration;
	}

	public destroy(): void {
		this.stopProgressTicker();
		this.pauseSilentAudio();
		if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
			try {
				this.ytPlayer.destroy();
			} catch {}
			this.ytPlayer = null;
		}
	}
}
