ALTER TABLE matches
    ADD COLUMN first_scoring_team_id INT NULL DEFAULT NULL AFTER opening_team_id,
    ADD COLUMN is_goal_in_first_half BOOLEAN NULL DEFAULT NULL AFTER first_scoring_team_id,
    ADD CONSTRAINT fk_matches_first_scoring_team
        FOREIGN KEY (first_scoring_team_id)
        REFERENCES teams(id),
    ADD CONSTRAINT ck_matches_first_scoring_team_participant
        CHECK (
            first_scoring_team_id IS NULL
            OR first_scoring_team_id = team1_id
            OR first_scoring_team_id = team2_id
        ),
    ADD INDEX ix_matches_first_scoring_team_id (first_scoring_team_id);

ALTER TABLE predictions
    ADD COLUMN first_scoring_team_id INT NULL DEFAULT NULL AFTER opening_team_id,
    ADD COLUMN is_goal_in_first_half BOOLEAN NULL DEFAULT NULL AFTER first_scoring_team_id,
    ADD CONSTRAINT fk_predictions_first_scoring_team
        FOREIGN KEY (first_scoring_team_id)
        REFERENCES teams(id),
    ADD INDEX ix_predictions_first_scoring_team_id (first_scoring_team_id);
