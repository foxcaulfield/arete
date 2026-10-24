-- Convert additionalCorrectAnswers and distractors from TEXT[] to JSON-encoded TEXT
-- Required by Option A (provider-agnostic JSON arrays for cross-DB compatibility)

ALTER TABLE "exercises"
  ALTER COLUMN "additional_correct_answers" DROP DEFAULT,
  ALTER COLUMN "additional_correct_answers" TYPE TEXT
    USING COALESCE(to_json("additional_correct_answers")::text, '[]'),
  ALTER COLUMN "additional_correct_answers" SET DEFAULT '[]';

ALTER TABLE "exercises"
  ALTER COLUMN "distractors" DROP DEFAULT,
  ALTER COLUMN "distractors" TYPE TEXT
    USING COALESCE(to_json("distractors")::text, '[]'),
  ALTER COLUMN "distractors" SET DEFAULT '[]';
