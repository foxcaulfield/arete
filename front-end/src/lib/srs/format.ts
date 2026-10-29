export function formatNextReview(iso: string | null | undefined): string {
	if (!iso) return "";
	const ms = new Date(iso).getTime() - Date.now();
	const days = Math.round(ms / 86_400_000);
	if (days <= 0) return "today";
	if (days === 1) return "tomorrow";
	if (days < 7) return `in ${days} days`;
	if (days < 30) {
		const w = Math.round(days / 7);
		return `in ${w} week${w === 1 ? "" : "s"}`;
	}
	if (days < 365) {
		const m = Math.round(days / 30);
		return `in ${m} month${m === 1 ? "" : "s"}`;
	}
	const y = Math.round(days / 365);
	return `in ${y} year${y === 1 ? "" : "s"}`;
}
