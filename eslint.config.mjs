// @ts-check
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";

export default tseslint.config(
	{
		// ignores: ["eslint.config.mjs", "dist/**", "node_modules/**"],
		// ignores: ["eslint.config.mjs", "dist/**", "node_modules/**", "front-end/**"],

		ignores: [
			"eslint.config.mjs",
			"dist/**",
			"node_modules/**",
			"front-end/**",
			// "generated/**",
			"public/**",
			"src/generated/**",
			"prisma.config.ts",
			"scripts/**",
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
			},
			sourceType: "commonjs",
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			prettier: prettierPlugin,
		},
	},
	{
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-floating-promises": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",
			"prettier/prettier": [
				"error",
				{
					singleQuote: false,
					trailingComma: "es5",
					useTabs: true,
					tabWidth: 4,
					printWidth: 120,
				},
			],
			"@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "explicit" }],
			"@typescript-eslint/explicit-function-return-type": [
				"error",
				{
					allowExpressions: false,
					allowTypedFunctionExpressions: false,
					allowHigherOrderFunctions: false,
					allowDirectConstAssertionInArrowFunctions: false,
					allowConciseArrowFunctionExpressionsStartingWithVoid: false,
				},
			],
		},
	},
	{
		files: ["front-end/**/*.ts"],
		languageOptions: {
			sourceType: "module",
			globals: { ...globals.browser },
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-member-accessibility": "off",
			"@typescript-eslint/no-floating-promises": "off",
		},
	}
);
