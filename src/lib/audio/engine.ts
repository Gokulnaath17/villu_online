export type EngineEventCallbacks = {
	onTimeUpdate: (position: number, duration: number) => void;
	onEnded: () => void;
	onLoading: (isLoading: boolean) => void;
	onError: (error: string) => void;
	onPreloadNeeded: () => void;
};
export class AudioEngine {
	private audioA: HTMLAudioElement;
	private audioB: HTMLAudioElement;
	private activeIsA: boolean = true;
	private callbacks: EngineEventCallbacks;
	private rafId: number | null = null;
	private preloadTriggered: boolean = false;
	private volume: number = 1.0;
	private isMuted: boolean = false;
	private currentVideoId: string | null = null;
	private preloadedVideoId: string | null = null;

	constructor(callbacks: EngineEventCallbacks) {
		this.callbacks = callbacks;

		if (typeof window !== 'undefined') {
			this.audioA = new Audio();
			this.audioB = new Audio();

			this.setupAudioElement(this.audioA, 'A');
			this.setupAudioElement(this.audioB, 'B');

			this.startRafLoop();
		} else {
			this.audioA = {} as HTMLAudioElement;
			this.audioB = {} as HTMLAudioElement;
		}
	}

	private get active(): HTMLAudioElement {
		return this.activeIsA ? this.audioA : this.audioB;
	}

	private get inactive(): HTMLAudioElement {
		return this.activeIsA ? this.audioB : this.audioA;
	}

	private setupAudioElement(el: HTMLAudioElement, tag: 'A' | 'B') {
		el.preload = 'auto';

		el.addEventListener('ended', () => {
			if ((this.activeIsA && tag === 'A') || (!this.activeIsA && tag === 'B')) {
				this.callbacks.onEnded();
			}
		});

		el.addEventListener('waiting', () => {
			if ((this.activeIsA && tag === 'A') || (!this.activeIsA && tag === 'B')) {
				this.callbacks.onLoading(true);
			}
		});

		el.addEventListener('playing', () => {
			if ((this.activeIsA && tag === 'A') || (!this.activeIsA && tag === 'B')) {
				this.callbacks.onLoading(false);
			}
		});

		el.addEventListener('canplay', () => {
			if ((this.activeIsA && tag === 'A') || (!this.activeIsA && tag === 'B')) {
				this.callbacks.onLoading(false);
			}
		});

		el.addEventListener('timeupdate', () => {
			if ((this.activeIsA && tag === 'A') || (!this.activeIsA && tag === 'B')) {
				if (!el.paused && el.currentTime > 0) {
					this.callbacks.onLoading(false);
				}
			}
		});

		el.addEventListener('error', () => {
			if ((this.activeIsA && tag === 'A') || (!this.activeIsA && tag === 'B')) {
				this.callbacks.onLoading(false);
				const mediaError = el.error;
				const msg = mediaError?.message || `Audio element error code ${mediaError?.code}`;
				console.warn(`AudioEngine [${tag}] error:`, msg);
				this.callbacks.onError(msg);
			}
		});
	}

	private startRafLoop() {
		const tick = () => {
			const el = this.active;
			if (el && !el.paused && el.duration) {
				const pos = el.currentTime;
				const dur = el.duration;
				this.callbacks.onTimeUpdate(pos, dur);

				// Preload next track trigger (20s lookahead window from MECHANISM.md §5.4)
				if (dur > 25 && dur - pos < 20 && !this.preloadTriggered) {
					this.preloadTriggered = true;
					this.callbacks.onPreloadNeeded();
				}
			}
			this.rafId = requestAnimationFrame(tick);
		};
		this.rafId = requestAnimationFrame(tick);
	}

	public async playUrl(videoId: string, streamUrl: string, startPos: number = 0): Promise<void> {
		this.preloadTriggered = false;
		this.currentVideoId = videoId;
		this.callbacks.onLoading(true);

		// If this video was preloaded into inactive audio, swap seamlessly
		if (this.preloadedVideoId === videoId && this.inactive.src) {
			const oldActive = this.active;
			const newActive = this.inactive;

			// Swap active pointer
			this.activeIsA = !this.activeIsA;
			this.preloadedVideoId = null;

			// Fade out previous audio
			this.fadeVolume(oldActive, oldActive.volume, 0, 150).then(() => {
				oldActive.pause();
				oldActive.currentTime = 0;
			});

			// Fade in new audio
			newActive.volume = this.isMuted ? 0 : this.volume;
			if (startPos > 0 && newActive.duration) {
				newActive.currentTime = startPos;
			}
			try {
				await newActive.play();
				this.callbacks.onLoading(false);
				return;
			} catch (err: any) {
				console.warn('Preloaded play failed, falling back to fresh load:', err);
			}
		}

		// Otherwise load freshly into active audio
		const cur = this.active;
		cur.pause();
		cur.src = streamUrl;
		cur.volume = this.isMuted ? 0 : this.volume;

		if (startPos > 0) {
			const onLoaded = () => {
				cur.currentTime = startPos;
				cur.removeEventListener('loadedmetadata', onLoaded);
			};
			cur.addEventListener('loadedmetadata', onLoaded);
		}

		try {
			await cur.play();
			this.callbacks.onLoading(false);
		} catch (err: any) {
			this.callbacks.onLoading(false);
			throw err;
		}
	}

	/**
	 * Preload next track stream URL into the background inactive audio element
	 */
	public preloadNext(videoId: string, streamUrl: string): void {
		if (this.currentVideoId === videoId || this.preloadedVideoId === videoId) return;

		this.preloadedVideoId = videoId;
		const next = this.inactive;
		next.src = streamUrl;
		next.volume = 0;
		next.load();
	}

	public pause(): void {
		this.active.pause();
	}

	public async resume(): Promise<void> {
		if (this.active.src) {
			await this.active.play();
		}
	}

	public seek(seconds: number): void {
		if (this.active && this.active.duration) {
			this.active.currentTime = Math.max(0, Math.min(seconds, this.active.duration));
		}
	}

	public setVolume(vol: number): void {
		this.volume = Math.max(0, Math.min(1, vol));
		if (!this.isMuted) {
			this.active.volume = this.volume;
		}
	}

	public setMuted(muted: boolean): void {
		this.isMuted = muted;
		this.active.volume = muted ? 0 : this.volume;
	}

	public get isPlaying(): boolean {
		return !!this.active && !this.active.paused && !this.active.ended;
	}

	public get position(): number {
		return this.active?.currentTime || 0;
	}

	public get duration(): number {
		return this.active?.duration || 0;
	}

	private fadeVolume(
		el: HTMLAudioElement,
		from: number,
		to: number,
		durationMs: number
	): Promise<void> {
		return new Promise((resolve) => {
			const steps = 10;
			const stepTime = durationMs / steps;
			const diff = (to - from) / steps;
			let step = 0;

			const interval = setInterval(() => {
				step++;
				el.volume = Math.max(0, Math.min(1, from + diff * step));
				if (step >= steps) {
					clearInterval(interval);
					resolve();
				}
			}, stepTime);
		});
	}

	public destroy() {
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.audioA.pause();
		this.audioB.pause();
		this.audioA.src = '';
		this.audioB.src = '';
	}
}
