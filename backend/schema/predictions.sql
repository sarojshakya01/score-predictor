CREATE TABLE predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,
    match_id INT NOT NULL,

    team1_score INT NOT NULL,
    team2_score INT NOT NULL,
    yellow_card_count INT NOT NULL,
    red_card_count INT NOT NULL,

    opening_team_id INT NOT NULL,
    first_scoring_team_id INT NULL DEFAULT NULL,
    is_goal_in_first_half BOOLEAN NULL DEFAULT NULL,

    game_duration ENUM('90', '120', 'PENALTY') NOT NULL,

    predicted_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- TimestampMixin fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_predictions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT fk_predictions_match
        FOREIGN KEY (match_id)
        REFERENCES matches(id),

    CONSTRAINT fk_predictions_opening_team
        FOREIGN KEY (opening_team_id)
        REFERENCES teams(id),

    CONSTRAINT fk_predictions_first_scoring_team
        FOREIGN KEY (first_scoring_team_id)
        REFERENCES teams(id),

    -- Unique Constraints
    CONSTRAINT uq_predictions_user_match
        UNIQUE (user_id, match_id),

    -- Check Constraints
    CONSTRAINT ck_predictions_team1_score_nonnegative
        CHECK (team1_score >= 0),

    CONSTRAINT ck_predictions_team2_score_nonnegative
        CHECK (team2_score >= 0),

    CONSTRAINT ck_predictions_yellow_card_count_nonnegative
        CHECK (yellow_card_count >= 0),

    CONSTRAINT ck_predictions_red_card_count_nonnegative
        CHECK (red_card_count >= 0),

    -- Indexes
    INDEX ix_predictions_user_id (user_id),
    INDEX ix_predictions_match_id (match_id),
    INDEX ix_predictions_opening_team_id (opening_team_id),
    INDEX ix_predictions_first_scoring_team_id (first_scoring_team_id),
    INDEX ix_predictions_predicted_datetime (predicted_datetime)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
