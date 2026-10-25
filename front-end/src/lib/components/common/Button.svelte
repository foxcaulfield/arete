<script lang="ts">
	// import type { IconProps } from "@lucide/svelte";
	import type { Component } from "svelte";
	// import type { Component } from "svelte";
	import type { ClassValue } from "svelte/elements";

	type CommonProps = {
		type?: "button" | "submit" | "reset";
		name?: string;
		value?: string;
		title?: string;
		preset?: StyleProps.Preset;
		color?: StyleProps.Color;
		size?: StyleProps.Size;
		icon?: boolean;
		disabled?: boolean;
		loading?: boolean;
		buttonElement?: HTMLButtonElement | undefined;
		class?: ClassValue;
		fullWidth?: boolean;
		isBorderless?: boolean;
		onclick?: (e: Event) => void;
		[rest: string]: any;
	};

	type WithIcon = {
		text?: string;
		useIcon: true;
		// IconComponent: Component<IconProps, {}, "">;
		IconComponent: Component<any, any, any>;
	};
	type WithoutIcon = {
		text: string;
		useIcon?: false;
		IconComponent?: undefined;
	};
	type ButtonProps = CommonProps & (WithIcon | WithoutIcon);

	let {
		text,
		type = "button",
		name,
		value,
		title,
		preset = "filled",
		color = "primary",
		size = "base",
		disabled: disabledProp = false,
		class: cls,
		buttonElement = $bindable(),
		loading = false,
		useIcon = false,
		IconComponent,
		fullWidth = false,
		isBorderless: withoutBorder = false,
		onclick,
		icon = false,
		...rest
	}: ButtonProps = $props();

	const disabled = $derived(disabledProp || loading);

	const presetColorMap: Record<string, Record<string, string>> = {
		filled: {
			primary: "preset-filled-primary-500",
			secondary: "preset-filled-secondary-500",
			tertiary: "preset-filled-tertiary-500",
			success: "preset-filled-success-500",
			warning: "preset-filled-warning-500",
			error: "preset-filled-error-500",
			surface: "preset-filled-surface-500",
		},
		outlined: {
			primary: "preset-outlined-primary-500",
			secondary: "preset-outlined-secondary-500",
			tertiary: "preset-outlined-tertiary-500",
			success: "preset-outlined-success-500",
			warning: "preset-outlined-warning-500",
			error: "preset-outlined-error-500",
			surface: "preset-outlined-surface-500",
		},
		ghost: {
			primary: "hover:preset-tonal-primary",
			secondary: "hover:preset-tonal-secondary",
			tertiary: "hover:preset-tonal-tertiary",
			success: "hover:preset-tonal-success",
			warning: "hover:preset-tonal-warning",
			error: "hover:preset-tonal-error",
			surface: "hover:preset-tonal-surface",
		},
		tonal: {
			primary: "preset-tonal-primary",
			secondary: "preset-tonal-secondary",
			tertiary: "preset-tonal-tertiary",
			success: "preset-tonal-success",
			warning: "preset-tonal-warning",
			error: "preset-tonal-error",
			surface: "preset-tonal-surface",
		},
	};

	const presetClass = $derived(presetColorMap[preset]?.[color] ?? "preset-filled-primary-500");

	const computedClass = $derived(
		[
			icon ? "btn-icon" : "btn", // ← btn-icon replaces btn entirely
			!icon ? `btn-${size}` : "", // ← no btn-sm etc. when icon
			presetClass,
			cls,
			fullWidth ? "full-width" : "",
			withoutBorder ? "border-none" : "",
		]
			.filter(Boolean)
			.join(" ")
	);
</script>

<!-- <button
	{name}
	{value}
	{title}
	bind:this={buttonElement}
	{type}
	{disabled}
	class={["btn", `btn-${size}`, presetClass, cls, fullWidth ? "full-width" : "", withoutBorder ? "border-none" : ""]
		.filter(Boolean)
		.join(" ")}
	{onclick}
	{...rest}
>
	{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
	{#if useIcon && !loading}<IconComponent size="1em" />{/if}
	{#if text && !loading}<span>{text}</span>{/if}
</button> -->

<button
	{name}
	{value}
	{title}
	bind:this={buttonElement}
	{type}
	{disabled}
	class={computedClass}
	onclick={(e) => {
		onclick?.(e);
	}}
	{...rest}
>
	{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
	{#if useIcon && !loading}<IconComponent size="1em" />{/if}
	{#if text && !loading}<span>{text}</span>{/if}
</button>

<style>
	.full-width {
		width: 100%;
	}
	.spinner {
		display: inline-block;
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		opacity: 0.8;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
