<script lang="ts">
	import { playerStore } from '#lib/stores/player.svelte';
	import { queueStore } from '#lib/stores/queue.svelte';
	import { libraryStore } from '#lib/stores/library.svelte';
	import { formatTime } from '#lib/utils';
	import {
		Play,
		Pause,
		SkipBack,
		SkipForward,
		Shuffle,
		Repeat,
		Repeat1,
		Volume2,
		VolumeX,
		ListMusic,
		Maximize2,
		Heart,
		Loader2
	} from '@lucide/svelte';

	let isDraggingScrubber = $state(false);
	let scrubPercent = $state(0);

	let currentTrack = $derived(playerStore.currentTrack);
	let isPlaying = $derived(playerStore.isPlaying);
	let isLoading = $derived(playerStore.isLoading);
	let isLiked = $derived(currentTrack ? libraryStore.isLiked(currentTrack.videoId) : false);

	let progressPercent = $derived(
		isDraggingScrubber
			? scrubPercent
			: playerStore.duration > 0
				? (playerStore.position / playerStore.duration) * 100
				: 0
	);

	function handleScrubberInput(e: Event) {
		const target = e.target as HTMLInputElement;
		scrubPercent = parseFloat(target.value);
	}

	function handleScrubberChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const pct = parseFloat(target.value);
		const targetTime = (pct / 100) * playerStore.duration;
		playerStore.seek(targetTime);
		isDraggingScrubber = false;
	}

	function handleVolumeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		playerStore.setVolume(parseFloat(target.value));
	}
</script>

{#if currentTrack}
	<aside aria-label="Audio Player" class="fixed bottom-0 left-0 right-0 z-30 glass-dock select-none px-4 py-2.5 sm:px-6 sm:py-3 transition-transform duration-300">
		<!-- Progress advancement bar -->
		<div class="relative w-full group -top-2.5 sm:-top-3 cursor-pointer">
			<div class="w-full h-1 bg-white/10 group-hover:h-2 rounded-full overflow-hidden transition-all duration-150">
				<div
					class="h-full bg-sky-400 group-hover:bg-sky-300 rounded-full transition-all duration-75 relative"
					style="width: {Math.max(0, Math.min(100, progressPercent))}%"
				></div>
			</div>
			<input
				type="range"
				min="0"
				max="100"
				step="0.1"
				value={progressPercent}
				oninput={handleScrubberInput}
				onchange={handleScrubberChange}
				onmousedown={() => (isDraggingScrubber = true)}
				ontouchstart={() => (isDraggingScrubber = true)}
				class="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
				title="Seek progress"
			/>
		</div>

		<div class="flex items-center justify-between gap-4 max-w-7xl mx-auto">
			<!-- Track Details (Left) -->
			<div class="flex items-center gap-3 min-w-0 w-1/4">
				<button
					class="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group shadow-md bg-zinc-800"
					onclick={() => playerStore.toggleExpand()}
					title="Expand player"
				>
					<img
						src={currentTrack.thumbnail}
						alt={currentTrack.title}
						class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
					/>
					<div
						class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
					>
						<Maximize2 class="w-4 h-4 text-white" />
					</div>
				</button>

				<div class="min-w-0">
					<button
						type="button"
						class="text-sm font-semibold text-zinc-100 truncate hover:text-white cursor-pointer text-left block max-w-full"
						onclick={() => playerStore.toggleExpand()}
					>
						{currentTrack.title}
					</button>
					<p class="text-xs text-zinc-400 truncate mt-0.5">
						{currentTrack.artist}
					</p>
				</div>

				<button
					type="button"
					class="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0 hidden sm:block"
					onclick={() => libraryStore.toggleLike(currentTrack)}
					title={isLiked ? 'Unlike' : 'Like'}
				>
					<Heart class="w-4 h-4 {isLiked ? 'text-rose-500 fill-rose-500' : ''}" />
				</button>
			</div>

			<!-- Center Transport Controls & Timing -->
			<div class="flex flex-col items-center gap-1 flex-1 max-w-md">
				<div class="flex items-center gap-3 sm:gap-5">
					<!-- Shuffle -->
					<button
						type="button"
						class="p-1.5 rounded-full hover:bg-white/10 transition-colors {queueStore.isShuffle ? 'text-sky-400' : 'text-zinc-400 hover:text-zinc-200'}"
						onclick={() => queueStore.toggleShuffle()}
						title="Shuffle"
					>
						<Shuffle class="w-4 h-4" />
					</button>

					<!-- Skip Previous -->
					<button
						type="button"
						class="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
						onclick={() => playerStore.skipPrevious()}
						title="Previous"
					>
						<SkipBack class="w-5 h-5 fill-current" />
					</button>

					<!-- Play / Pause -->
					<button
						type="button"
						class="p-2.5 sm:p-3 rounded-full bg-white hover:bg-zinc-200 text-black shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 flex items-center justify-center"
						onclick={() => playerStore.togglePlay()}
						title={isPlaying ? 'Pause' : 'Play'}
					>
						{#if isLoading}
							<Loader2 class="w-5 h-5 animate-spin text-black" />
						{:else if isPlaying}
							<Pause class="w-5 h-5 fill-black" />
						{:else}
							<Play class="w-5 h-5 fill-black translate-x-0.5" />
						{/if}
					</button>

					<!-- Skip Next -->
					<button
						type="button"
						class="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
						onclick={() => playerStore.skipNext()}
						title="Next"
					>
						<SkipForward class="w-5 h-5 fill-current" />
					</button>

					<!-- Repeat -->
					<button
						type="button"
						class="p-1.5 rounded-full hover:bg-white/10 transition-colors {queueStore.loopMode !== 'off' ? 'text-sky-400' : 'text-zinc-400 hover:text-zinc-200'}"
						onclick={() => queueStore.cycleLoopMode()}
						title={`Repeat: ${queueStore.loopMode}`}
					>
						{#if queueStore.loopMode === 'one'}
							<Repeat1 class="w-4 h-4" />
						{:else}
							<Repeat class="w-4 h-4" />
						{/if}
					</button>
				</div>

				<!-- Time display -->
				<div class="flex items-center gap-2 text-[11px] font-mono text-zinc-400 tracking-tight">
					<span>{formatTime(playerStore.position)}</span>
					<span>/</span>
					<span>{formatTime(playerStore.duration)}</span>
				</div>
			</div>

			<!-- Right Secondary Controls (Volume, Queue, Expand) -->
			<div class="flex items-center justify-end gap-3 w-1/4">
				<!-- Queue Toggle -->
				<button
					type="button"
					class="p-2 rounded-full hover:bg-white/10 transition-colors relative {playerStore.isQueueOpen ? 'text-sky-400' : 'text-zinc-400 hover:text-white'}"
					onclick={() => playerStore.toggleQueue()}
					title="Queue"
				>
					<ListMusic class="w-5 h-5" />
					{#if queueStore.tracks.length > 0}
						<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-400"></span>
					{/if}
				</button>

				<!-- Volume Slider (Desktop) -->
				<div class="hidden lg:flex items-center gap-2">
					<button
						type="button"
						class="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
						onclick={() => playerStore.toggleMute()}
						title={playerStore.isMuted ? 'Unmute' : 'Mute'}
					>
						{#if playerStore.isMuted || playerStore.volume === 0}
							<VolumeX class="w-4 h-4" />
						{:else}
							<Volume2 class="w-4 h-4" />
						{/if}
					</button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={playerStore.isMuted ? 0 : playerStore.volume}
						oninput={handleVolumeChange}
						class="w-20 h-1 bg-white/20 rounded-full appearance-none accent-sky-400 cursor-pointer"
						title="Volume"
					/>
				</div>

				<!-- Expand Player -->
				<button
					type="button"
					class="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors hidden sm:block"
					onclick={() => playerStore.toggleExpand()}
					title="Expand"
				>
					<Maximize2 class="w-4 h-4" />
				</button>
			</div>
		</div>
	</aside>
{/if}
