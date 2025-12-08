import { Module } from "@nestjs/common";
import { ExercisesController } from "./exercises.controller";
import { ExercisesService } from "./exercises.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CollectionsModule } from "src/collections/collections.module";
import { CommonModule } from "src/common/common.module";
import { QuizService } from "./quiz.service";
import { ExerciseQueryService } from "./exercise-query.service";
import { ExerciseValidationService } from "./exercise-validation.service";
import { EXERCISE_RULES_SYMBOL, ExerciseRulesConfig } from "src/exercises/exercise-rules.config";
import { QUIZ_SESSION_STORE, InMemoryQuizSessionStore } from "./quiz-session.store";

export const exerciseRulesSettings: ExerciseRulesConfig = {
	DISTRACTORS_PER_QUESTION: 3,
	MIN_DISTRACTORS_FOR_EXERCISE: 5,
	MIN_DISTRACTOR_CHAR_LENGTH: 1,
	MAX_DISTRACTOR_CHAR_LENGTH: 50,
};

@Module({
	imports: [CommonModule, CollectionsModule],
	controllers: [ExercisesController],
	providers: [
		{ provide: EXERCISE_RULES_SYMBOL, useValue: exerciseRulesSettings },
		{ provide: QUIZ_SESSION_STORE, useClass: InMemoryQuizSessionStore },
		ExercisesService,
		PrismaService,
		QuizService,
		ExerciseQueryService,
		ExerciseValidationService,
	],
	exports: [ExercisesService, QuizService, QUIZ_SESSION_STORE],
})
export class ExercisesModule {}
