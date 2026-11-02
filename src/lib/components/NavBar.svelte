<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Search, Disc3, Home, Library } from '@lucide/svelte';

	let searchQuery = $state('');

	function handleSearchSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!searchQuery.trim()) return;
		goto(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
	}
</script>

<header class="h-16 px-4 sm:px-8 border-b border-white/5 flex items-center justify-between gap-4 shrink-0 bg-zinc-950/60 backdrop-blur-md z-20">
	<!-- Mobile Brand Logo -->
	<div class="flex items-center gap-2.5 md:hidden">
		<div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center">
			<Disc3 class="w-4 h-4 text-white" />
		</div>
		<span class="text-sm font-bold text-white">Villu</span>
	</div>

	<!-- Search Input Bar -->
	<form onsubmit={handleSearchSubmit} class="flex-1 max-w-md relative">
		<Search class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Search songs, artists, albums..."
			class="w-full bg-zinc-900/90 border border-white/10 rounded-full pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner"
		/>
	</form>

	<!-- Mobile Navigation Bar -->
	<div class="flex items-center gap-1 md:hidden">
		<a
			href="/"
			class="p-2 rounded-lg text-zinc-400 hover:text-white {page.url.pathname === '/' ? 'text-sky-400' : ''}"
			title="Home"
		>
			<Home class="w-5 h-5" />
		</a>
		<a
			href="/library"
			class="p-2 rounded-lg text-zinc-400 hover:text-white {page.url.pathname.startsWith('/library') ? 'text-sky-400' : ''}"
			title="Library"
		>
			<Library class="w-5 h-5" />
		</a>
	</div>
</header>

