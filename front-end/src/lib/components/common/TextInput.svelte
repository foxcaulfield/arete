<script lang="ts">
	import type { FullAutoFill } from "svelte/elements";

	type TextInputProps = {
		id?: string;
		value?: string;
		autocomplete?: FullAutoFill;
		placeholder?: string;
		nameIsSameAsId?: boolean;
		inputElement?: HTMLInputElement;
		errors?: string | string[];
		[rest: string]: any;
	};

	// Mark `value` as bindable so parent components can use `bind:value={...}`
	let {
		value = $bindable(),
		autocomplete,
		placeholder,
		name,
		id,
		nameIsSameAsId,
		inputElement = $bindable(),
		errors,
		...rest
	}: TextInputProps = $props();
</script>

<div>
	<!-- {#if withLabel} -->
	<label for={id} class="label">
		<span class="label-text">{placeholder ?? "Input"} </span>
		<input
			class="input"
			type="text"
			bind:value
			bind:this={inputElement}
			autocomplete={autocomplete ?? "off"}
			placeholder={placeholder ?? "Enter text"}
			{id}
			name={nameIsSameAsId ? id : name}
			{...rest}
		/>
	</label>
	<!-- {/if} -->

	{#if errors}
		<!-- comma separated list of errors -->
		{#if Array.isArray(errors)}
			<span>{errors.join(", ")}</span>
		{:else}
			<span>{errors}</span>
		{/if}
	{/if}
</div>
