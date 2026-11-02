<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { playerStore } from '#lib/stores/player.svelte';
	import TrackCard from '#lib/components/TrackCard.svelte';
	import type { SongTrack } from '#lib/types';
	import { Search, Play, Loader2, Sparkles } from '@lucide/svelte';

	let query = $state('');
	let results = $state<SongTrack[]>([]);
	let isLoading = $state(false);
	let hasSearched = $state(false);

	const quickTags = [
		'A.R. Rahman',
		'Anirudh Ravichander',
		'Yuvan Shankar Raja',
		'Harris Jayaraj',
		'Ilaiyaraaja',
		'Tamil Chill Lofi',
		'Acoustic Pop'
	];

	async function performSearch(searchTerm: string) {
		if (!searchTerm.trim()) {
			results = [];
			hasSearched = false;
			return;
		}

		isLoading = true;
		hasSearched = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm.trim())}`);
			if (res.ok) {
				results = await res.json();
			} else {
				results = [];
			}
		} catch (err) {
			console.error('Search error:', err);
			results = [];
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		const qParam = page.url.searchParams.get('q');
		if (qParam && qParam !== query) {
			query = qParam;
			performSearch(qParam);
		}
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!query.trim()) return;
		goto(`/search?q=${encodeURIComponent(query.trim())}`);
		performSearch(query.trim());
	}

	function handleTagClick(tag: string) {
		query = tag;
		goto(`/search?q=${encodeURIComponent(tag)}`);
		performSearch(tag);
	}

	function playAll() {
		if (results.length > 0) {
			playerStore.playTrack(results[0], results, 0);
		}
	}
</script>

<div class="space-y-8 animate-in fade-in duration-200">
	<!-- Search Box Stage -->
	<div class="space-y-4">
		<h2 class="text-2xl sm:text-3xl font-extrabold text-white">Search Music</h2>

		<form onsubmit={handleSubmit} class="relative max-w-2xl">
			<Search class="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
			<input
				type="search"
				bind:value={query}
				placeholder="Search for songs, artists, or soundtracks..."
				class="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-xl"
			/>
		</form>

		<!-- Quick Filter Tags -->
		<div class="flex items-center gap-2 flex-wrap pt-1">
			<span class="text-xs text-zinc-500 font-medium mr-1 flex items-center gap-1">
				<Sparkles class="w-3 h-3 text-sky-400" />
				Trending:
			</span>
			{#each quickTags as tag}
				<button
					type="button"
					class="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all"
					onclick={() => handleTagClick(tag)}
				>
					{tag}
				</button>
			{/each}
		</div>
	</div>

	<!-- Search Results -->
	{#if isLoading}
		<div class="h-64 flex flex-col items-center justify-center text-zinc-500 gap-3">
			<Loader2 class="w-8 h-8 animate-spin text-sky-400" />
			<p class="text-xs font-medium tracking-wide">Searching stream catalogs...</p>
		</div>
	{:else if hasSearched}
		{#if results.length > 0}
			<section class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-semibold uppercase tracking-wider text-zinc-400">
						Found {results.length} Results
					</h3>
					<button
						type="button"
						class="text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
						onclick={playAll}
					>
						<Play class="w-3.5 h-3.5 fill-current" />
						Play All
					</button>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
					{#each results as track, idx}
						<TrackCard {track} index={idx} queueContext={results} showIndex={true} />
					{/each}
				</div>
			</section>
		{:else}
			<div class="h-64 flex flex-col items-center justify-center text-center text-zinc-500">
				<Search class="w-10 h-10 mb-2 stroke-1" />
				<p class="text-sm font-medium">No results found for "{query}"</p>
				<p class="text-xs text-zinc-600 mt-1">Try another search term or click one of the trending tags above</p>
			</div>
		{/if}
	{/if}
</div>
