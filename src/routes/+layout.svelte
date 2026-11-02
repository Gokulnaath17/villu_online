<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { playerStore } from '#lib/stores/player.svelte';
	import { libraryStore } from '#lib/stores/library.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import NavBar from '#lib/components/NavBar.svelte';
	import PlayerDock from '#lib/components/PlayerDock.svelte';
	import PlayerExpanded from '#lib/components/PlayerExpanded.svelte';
	import QueueDrawer from '#lib/components/QueueDrawer.svelte';

	let { children }: LayoutProps = $props();

	let isAuthPage = $derived(page.url.pathname === '/login');
	let user = $derived(page.data.user);

	let hasInitialized = false;
	$effect(() => {
		if (!isAuthPage && user && !hasInitialized) {
			hasInitialized = true;
			playerStore.init();
			libraryStore.loadAll();
		}
	});

	onMount(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (page.url.pathname === '/login') return;
			const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
			if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
				return;
			}

			if (e.code === 'Space') {
				e.preventDefault();
				playerStore.togglePlay();
			} else if (e.code === 'ArrowRight') {
				e.preventDefault();
				playerStore.seek(playerStore.position + 5);
			} else if (e.code === 'ArrowLeft') {
				e.preventDefault();
				playerStore.seek(Math.max(0, playerStore.position - 5));
			} else if (e.code === 'ArrowUp') {
				e.preventDefault();
				playerStore.setVolume(Math.min(1, playerStore.volume + 0.05));
			} else if (e.code === 'ArrowDown') {
				e.preventDefault();
				playerStore.setVolume(Math.max(0, playerStore.volume - 0.05));
			} else if (e.code === 'KeyM') {
				e.preventDefault();
				playerStore.toggleMute();
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Villu Online — Music Streaming</title>
</svelte:head>

{#if isAuthPage}
	<main class="h-screen w-screen bg-[#09090b] text-zinc-100 overflow-y-auto">
		{@render children()}
	</main>
{:else}
	<div class="flex h-screen w-screen bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
		<!-- Left Sidebar -->
		<Sidebar />

		<!-- Main Stage Area -->
		<div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
			<!-- Top Bar -->
			<NavBar />

			<!-- Main Viewport Scroll Container -->
			<main class="flex-1 overflow-y-auto pb-32 sm:pb-36 p-4 sm:p-8">
				<div class="max-w-7xl mx-auto">
					{@render children()}
				</div>
			</main>

			<!-- Persistent Player Bar -->
			<PlayerDock />
		</div>

		<!-- Queue Sliding Panel -->
		<QueueDrawer />

		<!-- Expanded Fullscreen Player -->
		<PlayerExpanded />
	</div>
{/if}
