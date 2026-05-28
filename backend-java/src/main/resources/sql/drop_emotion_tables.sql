-- Remove legacy emotion action mapping tables.
-- Run manually after deploying the code that no longer maps these entities.

DROP TABLE IF EXISTS model_emotion_action;
DROP TABLE IF EXISTS model_emotion;
DROP TABLE IF EXISTS emotion;
