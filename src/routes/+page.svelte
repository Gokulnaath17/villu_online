<script lang="ts">
	import { onMount } from 'svelte';
	import { playerStore } from '#lib/stores/player.svelte';
	import { libraryStore } from '#lib/stores/library.svelte';
	import TrackCard from '#lib/components/TrackCard.svelte';
	import type { SongTrack } from '#lib/types';
	import { Play, Sparkles, History, Compass, Loader2 } from '@lucide/svelte';

	interface Section {
		title: string;
		tracks: SongTrack[];
	}

	let sections = $state<Section[]>([]);
	let isLoading = $state(false);

	let greeting = $derived(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 18) return 'Good afternoon';
		return 'Good evening';
	});

	onMount(async () => {
		try {
			const res = await fetch('/api/home');
			if (res.ok) {
				sections = await res.json();
			}
		} catch (err) {
			console.warn('Home fetch error:', err);
		}
	});

	function playAll(tracks: SongTrack[]) {
		if (tracks.length > 0) {
			playerStore.playTrack(tracks[0], tracks, 0);
		}
	}
</script>

<div class="space-y-10 animate-in fade-in duration-300">
	<!-- Hero Header -->
	<div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-950/60 via-zinc-900 to-indigo-950/50 p-6 sm:p-10 border border-white/5 shadow-2xl">
		<div class="absolute -right-10 -bottom-10 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

		<div class="relative z-10 max-w-2xl space-y-3">
			<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sky-400 text-xs font-semibold backdrop-blur-md">
				<Sparkles class="w-3.5 h-3.5" />
				High Fidelity Audio
			</div>
			<h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
				{greeting()}, Gokul
			</h2>
			<p class="text-sm sm:text-base text-zinc-400">
				Stream any music with zero downloads. Gapless playback, instant preloading, and uninterrupted sound.
			</p>
		</div>
	</div>

	<!-- Recently Played (If any exists) -->
	{#if libraryStore.history.length > 0}
		<section class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-bold text-white flex items-center gap-2">
					<History class="w-5 h-5 text-sky-400" />
					Recently Played
				</h3>
				<button
					type="button"
					class="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
					onclick={() => playAll(libraryStore.history)}
				>
					<Play class="w-3.5 h-3.5 fill-current" />
					Play all
				</button>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
				{#each libraryStore.history.slice(0, 6) as track, idx}
					<TrackCard {track} index={idx} queueContext={libraryStore.history} showIndex={false} />
				{/each}
			</div>
		</section>
	{/if}

	<!-- Home Sections -->
	{#if isLoading}
		<div class="h-64 flex flex-col items-center justify-center text-zinc-500 gap-3">
			<Loader2 class="w-8 h-8 animate-spin text-sky-400" />
			<p class="text-xs font-medium tracking-wide">Resolving stream channels...</p>
		</div>
	{:else}
		{#each sections as sec}
			{#if sec.tracks.length > 0}
				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="text-lg font-bold text-white flex items-center gap-2">
								<Compass class="w-5 h-5 text-sky-400" />
								{sec.title}
							</h3>
						</div>
						<button
							type="button"
							class="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
							onclick={() => playAll(sec.tracks)}
						>
							<Play class="w-3.5 h-3.5 fill-current" />
							Play all
						</button>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
						{#each sec.tracks as track, idx}
							<TrackCard {track} index={idx} queueContext={sec.tracks} showIndex={true} />
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	{/if}
</div>
