export function formatTime(seconds: number): string {
	if (isNaN(seconds) || seconds < 0) return '0:00';
	const s = Math.floor(seconds);
	const mins = Math.floor(s / 60);
	const secs = s % 60;
	return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function truncate(text: string, maxLen: number): string {
	if (!text) return '';
	return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export function getGreeting(date: Date = new Date()): string {
	const hour = date.getHours();
	if (hour >= 5 && hour < 12) return 'Good morning';
	if (hour >= 12 && hour < 18) return 'Good afternoon';
	return 'Good evening';
}

