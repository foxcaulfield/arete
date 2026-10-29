import { Expose } from "class-transformer";

export class UserStatsDto {
	@Expose() public collectionsOwned!: number;
	@Expose() public collectionsSharedWithMe!: number;
	@Expose() public exercisesCreated!: number;
	@Expose() public totalAttempts!: number;
	@Expose() public correctAttempts!: number;
	@Expose() public accuracy!: number; // 0..1
	@Expose() public currentStreak!: number;
	@Expose() public longestStreak!: number;
	@Expose() public lastActiveAt!: Date | null;

	// SRS breakdown
	@Expose() public srsNew!: number;
	@Expose() public srsLearning!: number;
	@Expose() public srsMature!: number;
	@Expose() public srsDueForReview!: number;
}
