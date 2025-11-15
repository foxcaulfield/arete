import { Injectable } from "@nestjs/common";

@Injectable()
export class UtilsService {
	/**
	 * Normalizes answer for comparison (lowercase, trimmed)
	 */
	public trimAndLowercase(inputString: string): string {
		return inputString.trim().toLowerCase();
	}

	/**
	 * Fisher-Yates shuffle algorithm
	 */
	public shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			// ensure they are not undefined
			[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
		}
		return shuffled;
	}
}
