<script lang="ts">
	import type { SongTrack } from '#lib/types';
	import { playerStore } from '#lib/stores/player.svelte';
	import { queueStore } from '#lib/stores/queue.svelte';
	import { libraryStore } from '#lib/stores/library.svelte';
	import { formatTime } from '#lib/utils';
	import { Play, Pause, Heart, MoreVertical, Plus, ListPlus, Radio, Download, ChevronRight, Check } from '@lucide/svelte';

	interface Props {
		track: SongTrack;
		index?: number;
		queueContext?: SongTrack[];
		showIndex?: boolean;
	}

	let { track, index, queueContext, showIndex = true }: Props = $props();

	let isMenuOpen = $state(false);
	let isPlaylistSelectOpen = $state(false);
	let isDownloadSelectOpen = $state(false);
	let downloadProgress = $state<number | null>(null);
	let isDownloadComplete = $state(false);

	let isCurrent = $derived(playerStore.currentTrack?.videoId === track.videoId);
	let isPlaying = $derived(isCurrent && playerStore.isPlaying);
	let isLiked = $derived(libraryStore.isLiked(track.videoId));

	function handlePlay() {
		if (isCurrent) {
			playerStore.togglePlay();
		} else {
			playerStore.playTrack(track, queueContext, index);
		}
	}

	function handleToggleLike(e: MouseEvent) {
		e.stopPropagation();
		libraryStore.toggleLike(track);
	}

	function handleAddToQueue(e: MouseEvent) {
		e.stopPropagation();
		queueStore.addToQueue(track);
		isMenuOpen = false;
	}

	function handlePlayNext(e: MouseEvent) {
		e.stopPropagation();
		queueStore.insertNext(track);
		isMenuOpen = false;
	}

	function handleAddToPlaylist(playlistId: string, e: MouseEvent) {
		e.stopPropagation();
		libraryStore.addTrackToPlaylist(playlistId, track);
		isPlaylistSelectOpen = false;
		isMenuOpen = false;
	}

	async function handleDownload(format: 'm4a' | 'webm' | 'opus', e: MouseEvent) {
		e.stopPropagation();
		if (downloadProgress !== null) return;

		isDownloadSelectOpen = false;
		isMenuOpen = false;
		downloadProgress = 0;
		isDownloadComplete = false;

		try {
			const params = new URLSearchParams({
				format,
				title: track.title,
				artist: track.artist
			});
			const res = await fetch(`/api/download/${track.videoId}?${params}`);
			if (!res.ok) throw new Error(`Download failed: ${res.status}`);

			const contentLengthHeader = res.headers.get('content-length');
			const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
			const reader = res.body?.getReader();

			if (!reader) {
				const blob = await res.blob();
				saveBlob(blob, format);
				downloadProgress = 100;
				isDownloadComplete = true;
				resetTracker();
				return;
			}

			let receivedBytes = 0;
			const chunks: Uint8Array[] = [];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value) {
					chunks.push(value);
					receivedBytes += value.length;
					if (contentLength > 0) {
						downloadProgress = Math.min(99, Math.round((receivedBytes / contentLength) * 100));
					} else {
						downloadProgress = Math.min(95, (downloadProgress ?? 0) + 5);
					}
				}
			}

			downloadProgress = 100;
			isDownloadComplete = true;

			const mimeType = format === 'webm' ? 'audio/webm' : format === 'opus' ? 'audio/ogg' : 'audio/mp4';
			const blob = new Blob(chunks as BlobPart[], { type: mimeType });
			saveBlob(blob, format);
			resetTracker();
		} catch (err) {
			console.error('Download error:', err);
			downloadProgress = null;
			isDownloadComplete = false;
		}
	}

	function saveBlob(blob: Blob, format: string) {
		const objectUrl = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = objectUrl;
		const ext = format === 'opus' ? 'opus' : format === 'webm' ? 'webm' : 'm4a';
		const safeTitle = `${track.artist} - ${track.title}`.replace(/[/\\?%*:|"<>]/g, '_');
		a.download = `${safeTitle}.${ext}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(objectUrl);
	}

	function resetTracker() {
		setTimeout(() => {
			downloadProgress = null;
			isDownloadComplete = false;
		}, 2000);
	}
</script>

<div
	class="group relative flex items-center gap-3.5 sm:gap-4 px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-2xl transition-all duration-200 cursor-pointer select-none hover:bg-white/[0.06] {isCurrent ? 'bg-white/[0.08]' : ''}"
	onclick={handlePlay}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handlePlay()}
>
	<!-- Index / Play indicator -->
	{#if showIndex && index !== undefined}
		<div class="w-6 text-center text-xs sm:text-sm font-medium text-zinc-500 group-hover:hidden shrink-0">
			{#if isPlaying}
				<span class="inline-block w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
			{:else}
				{index + 1}
			{/if}
		</div>
	{/if}

	<!-- Thumbnail with overlay -->
	<div class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-800 shadow-md">
		<img
			src={track.thumbnail}
			alt={track.title}
			class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
			loading="lazy"
		/>
		<div
			class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
		>
			{#if isPlaying}
				<Pause class="w-6 h-6 text-white fill-white" />
			{:else}
				<Play class="w-6 h-6 text-white fill-white translate-x-0.5" />
			{/if}
		</div>
	</div>

	<!-- Title & Artist -->
	<div class="flex-1 min-w-0 pr-2">
		<h4
			class="text-sm sm:text-base font-semibold line-clamp-2 leading-snug transition-colors {isCurrent ? 'text-sky-400' : 'text-zinc-100 group-hover:text-white'}"
			title={track.title}
		>
			{track.title}
		</h4>
		<p class="text-xs sm:text-sm text-zinc-400 truncate mt-1" title={track.artist}>
			{track.artist}
		</p>
	</div>

	<!-- Duration -->
	<div class="text-xs sm:text-sm text-zinc-400 font-mono tracking-tight shrink-0 hidden sm:block">
		{formatTime(track.duration)}
	</div>

	<!-- Like Button -->
	<button
		type="button"
		class="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0"
		onclick={handleToggleLike}
		title={isLiked ? 'Unlike' : 'Like'}
	>
		<Heart class="w-4 h-4 sm:w-4.5 sm:h-4.5 {isLiked ? 'text-rose-500 fill-rose-500' : ''}" />
	</button>

	<!-- Download Button with Tracker -->
	<div class="relative shrink-0">
		<button
			type="button"
			class="p-2 sm:p-2.5 rounded-full hover:bg-white/10 transition-colors shrink-0 {downloadProgress !== null ? 'text-sky-400' : 'text-zinc-400 hover:text-white'}"
			onclick={(e) => {
				e.stopPropagation();
				if (downloadProgress !== null) return;
				isDownloadSelectOpen = !isDownloadSelectOpen;
				isMenuOpen = false;
			}}
			title={downloadProgress !== null ? `Downloading: ${downloadProgress}%` : 'Download song'}
		>
			{#if isDownloadComplete}
				<Check class="w-4 h-4 text-emerald-400" />
			{:else if downloadProgress !== null}
				<!-- Live Download Progress Tracker -->
				<div class="relative flex items-center justify-center w-5 h-5">
					<svg class="w-5 h-5 -rotate-90" viewBox="0 0 36 36">
						<path
							class="text-zinc-700"
							stroke-width="4"
							stroke="currentColor"
							fill="none"
							d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
						/>
						<path
							class="text-sky-400 transition-all duration-150"
							stroke-dasharray="{downloadProgress}, 100"
							stroke-width="4"
							stroke-linecap="round"
							stroke="currentColor"
							fill="none"
							d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
						/>
					</svg>
					<span class="absolute text-[8px] font-mono font-bold text-sky-400 leading-none">
						{downloadProgress}
					</span>
				</div>
			{:else}
				<Download class="w-4 h-4" />
			{/if}
		</button>

		<!-- Format selector popup -->
		{#if isDownloadSelectOpen}
			<div
				class="absolute right-0 bottom-full mb-1 w-48 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl p-1.5 z-40 text-xs text-zinc-200"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="menu"
				tabindex="0"
			>
				<p class="px-2 py-1 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Select Format</p>
				<button
					class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-zinc-200 transition-colors"
					onclick={(e) => handleDownload('m4a', e)}
				>
					<span class="font-medium">M4A (AAC)</span>
					<span class="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">Recommended</span>
				</button>
				<button
					class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-zinc-200 transition-colors"
					onclick={(e) => handleDownload('webm', e)}
				>
					<span class="font-medium">WebM Audio</span>
					<span class="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">WebM</span>
				</button>
				<button
					class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-zinc-200 transition-colors"
					onclick={(e) => handleDownload('opus', e)}
				>
					<span class="font-medium">Opus Audio</span>
					<span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Opus</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- More Options Menu -->
	<div class="relative shrink-0">
		<button
			type="button"
			class="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
			onclick={(e) => {
				e.stopPropagation();
				isMenuOpen = !isMenuOpen;
				isPlaylistSelectOpen = false;
				isDownloadSelectOpen = false;
			}}
			title="More options"
		>
			<MoreVertical class="w-4 h-4 sm:w-4.5 sm:h-4.5" />
		</button>

		{#if isMenuOpen}
			<!-- Menu dropdown -->
			<div
				class="absolute right-0 top-full mt-1 w-48 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl py-1.5 z-40 text-xs text-zinc-200"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="menu"
				tabindex="0"
			>
				<button
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left"
					onclick={handlePlayNext}
				>
					<Radio class="w-3.5 h-3.5 text-zinc-400" />
					Play Next
				</button>
				<button
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left"
					onclick={handleAddToQueue}
				>
					<ListPlus class="w-3.5 h-3.5 text-zinc-400" />
					Add to Queue
				</button>
				<button
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left"
					onclick={(e) => {
						e.stopPropagation();
						isPlaylistSelectOpen = !isPlaylistSelectOpen;
					}}
				>
					<Plus class="w-3.5 h-3.5 text-zinc-400" />
					Add to Playlist...
				</button>

				{#if isPlaylistSelectOpen}
					<div class="mt-1 border-t border-white/10 pt-1 px-1">
						{#if libraryStore.playlists.length === 0}
							<div class="px-2 py-1 text-[11px] text-zinc-500 italic">No playlists yet</div>
						{:else}
							{#each libraryStore.playlists as pl}
								<button
									class="w-full flex items-center px-2 py-1.5 rounded hover:bg-white/10 text-left text-zinc-300 truncate"
									onclick={(e) => handleAddToPlaylist(pl.id, e)}
								>
									{pl.name}
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>