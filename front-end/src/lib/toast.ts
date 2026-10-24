import { toast } from "@zerodevx/svelte-toast";

export const toastInfo = (message: string, duration = 3000): void => {
	toast.push(message, {
		theme: { "--toastBackground": "#333", "--toastColor": "#fff", "--toastBarBackground": "#ff3e00" },
		duration,
	});
};

export const toastSuccess = (message: string, duration = 3000): void => {
	toast.push(message, {
		theme: { "--toastBackground": "#22c55e", "--toastColor": "#fff", "--toastBarBackground": "#16a34a" },
		duration,
	});
};

export const toastError = (message: string, duration = 3000): void => {
	toast.push(message, {
		theme: { "--toastBackground": "#ef4444", "--toastColor": "#fff", "--toastBarBackground": "#b91c1c" },
		duration,
	});
};

export const toastWarning = (message: string, duration = 3000): void => {
	toast.push(message, {
		theme: { "--toastBackground": "#fbbf24", "--toastColor": "#000", "--toastBarBackground": "#f59e0b" },
		duration,
	});
};
