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
		ChevronDown,
		Heart,
		Volume2,
		VolumeX,
		ListMusic,
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
</script>

{#if playerStore.isExpanded && currentTrack}
	<div
		class="fixed inset-0 z-50 flex flex-col justify-between bg-zinc-950/95 backdrop-blur-2xl p-6 sm:p-12 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
	>
		<!-- Background Glow Blur -->
		<div
			class="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none"
		></div>

		<!-- Top Header -->
		<div class="flex items-center justify-between z-10 w-full max-w-2xl mx-auto">
			<button
				type="button"
				class="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
				onclick={() => playerStore.setExpanded(false)}
				title="Collapse"
			>
				<ChevronDown class="w-6 h-6" />
			</button>

			<div class="text-center">
				<p class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Playing from queue</p>
				<p class="text-sm font-medium text-zinc-300 truncate max-w-xs">{currentTrack.album || 'Villu Online'}</p>
			</div>

			<button
				type="button"
				class="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors {playerStore.isQueueOpen ? 'text-sky-400' : 'text-zinc-300 hover:text-white'}"
				onclick={() => playerStore.toggleQueue()}
				title="Queue"
			>
				<ListMusic class="w-6 h-6" />
			</button>
		</div>

		<!-- Main Center Stage: Artwork -->
		<div class="my-auto flex flex-col items-center justify-center z-10 py-6">
			<div class="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/10">
				<img
					src={currentTrack.thumbnail}
					alt={currentTrack.title}
					class="w-full h-full object-cover transition-transform duration-700 {isPlaying ? 'scale-105' : 'scale-100'}"
				/>
				<div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
			</div>
		</div>

		<!-- Bottom Controls Container -->
		<div class="w-full max-w-2xl mx-auto z-10 space-y-6">
			<!-- Title, Artist & Like -->
			<div class="flex items-center justify-between">
				<div class="min-w-0 pr-4">
					<h2 class="text-xl sm:text-2xl font-bold text-white truncate">
						{currentTrack.title}
					</h2>
					<p class="text-sm sm:text-base text-zinc-400 truncate mt-1">
						{currentTrack.artist}
					</p>
				</div>
				<button
					type="button"
					class="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
					onclick={() => libraryStore.toggleLike(currentTrack)}
				>
					<Heart class="w-6 h-6 {isLiked ? 'text-rose-500 fill-rose-500' : ''}" />
				</button>
			</div>

			<!-- Large Scrubber -->
			<div class="space-y-2">
				<div class="relative w-full group py-2 cursor-pointer">
					<div class="w-full h-1.5 bg-white/10 group-hover:h-2 rounded-full overflow-hidden transition-all">
						<div
							class="h-full bg-sky-400 group-hover:bg-sky-300 rounded-full"
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
						class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
					/>
				</div>
				<div class="flex justify-between text-xs font-mono text-zinc-400">
					<span>{formatTime(playerStore.position)}</span>
					<span>{formatTime(playerStore.duration)}</span>
				</div>
			</div>

			<!-- Large Transport Controls -->
			<div class="flex items-center justify-between pt-2">
				<button
					type="button"
					class="p-2 rounded-full transition-colors {queueStore.isShuffle ? 'text-sky-400' : 'text-zinc-500 hover:text-zinc-300'}"
					onclick={() => queueStore.toggleShuffle()}
				>
					<Shuffle class="w-5 h-5" />
				</button>

				<button
					type="button"
					class="p-3 rounded-full text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
					onclick={() => playerStore.skipPrevious()}
				>
					<SkipBack class="w-7 h-7 fill-current" />
				</button>

				<button
					type="button"
					class="p-5 rounded-full bg-white hover:bg-zinc-200 text-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
					onclick={() => playerStore.togglePlay()}
				>
					{#if isLoading}
						<Loader2 class="w-8 h-8 animate-spin text-black" />
					{:else if isPlaying}
						<Pause class="w-8 h-8 fill-black" />
					{:else}
						<Play class="w-8 h-8 fill-black translate-x-0.5" />
					{/if}
				</button>

				<button
					type="button"
					class="p-3 rounded-full text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
					onclick={() => playerStore.skipNext()}
				>
					<SkipForward class="w-7 h-7 fill-current" />
				</button>

				<button
					type="button"
					class="p-2 rounded-full transition-colors {queueStore.loopMode !== 'off' ? 'text-sky-400' : 'text-zinc-500 hover:text-zinc-300'}"
					onclick={() => queueStore.cycleLoopMode()}
				>
					{#if queueStore.loopMode === 'one'}
						<Repeat1 class="w-5 h-5" />
					{:else}
						<Repeat class="w-5 h-5" />
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
