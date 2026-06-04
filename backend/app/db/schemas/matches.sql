CREATE TABLE matches (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Team References
    team1_id INT NOT NULL,
    team2_id INT NOT NULL,
    winner_id INT NULL DEFAULT NULL,

    -- Score Fields
    team1_score INT NULL DEFAULT NULL,
    team2_score INT NULL DEFAULT NULL,

    -- Match Statistics
    yellow_card_count INT NULL DEFAULT NULL,
    red_card_count INT NULL DEFAULT NULL,

    -- Kick-off Team
    kick_off_team_id INT NULL DEFAULT NULL,
    first_scoring_team_id INT NULL DEFAULT NULL,
    first_goal_in ENUM('1H', '2H', 'ET') NULL DEFAULT NULL,

    -- Match Duration
    match_duration ENUM('90', '120', 'PENALTY') NULL DEFAULT NULL,

    -- Match Stage
    match_stage ENUM('GROUP', 'R32', 'R16', 'QF', 'SF', '3P', 'F') NULL DEFAULT NULL,

    -- Scheduling
    match_datetime TIMESTAMP NOT NULL,
    match_day INT NOT NULL,
    venue_name VARCHAR(255) NOT NULL DEFAULT '',

    -- Status Flags
    match_locked BOOLEAN NOT NULL DEFAULT FALSE,
    match_reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,

    -- TimestampMixin fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_matches_team1
        FOREIGN KEY (team1_id)
        REFERENCES teams(id),

    CONSTRAINT fk_matches_team2
        FOREIGN KEY (team2_id)
        REFERENCES teams(id),

    CONSTRAINT fk_matches_winner
        FOREIGN KEY (winner_id)
        REFERENCES teams(id),

    CONSTRAINT fk_matches_kick_off_team
        FOREIGN KEY (kick_off_team_id)
        REFERENCES teams(id),

    CONSTRAINT fk_matches_first_scoring_team
        FOREIGN KEY (first_scoring_team_id)
        REFERENCES teams(id),

    -- Check Constraints
    CONSTRAINT ck_matches_distinct_teams
        CHECK (team1_id <> team2_id),

    CONSTRAINT ck_matches_team1_score_nonnegative
        CHECK (team1_score IS NULL OR team1_score >= 0),

    CONSTRAINT ck_matches_team2_score_nonnegative
        CHECK (team2_score IS NULL OR team2_score >= 0),

    CONSTRAINT ck_matches_yellow_card_count_nonnegative
        CHECK (yellow_card_count IS NULL OR yellow_card_count >= 0),

    CONSTRAINT ck_matches_red_card_count_nonnegative
        CHECK (red_card_count IS NULL OR red_card_count >= 0),

    CONSTRAINT ck_matches_match_day_positive
        CHECK (match_day > 0),

    CONSTRAINT ck_matches_kick_off_team_participant
        CHECK (
            kick_off_team_id IS NULL
            OR kick_off_team_id = team1_id
            OR kick_off_team_id = team2_id
        ),

    CONSTRAINT ck_matches_first_scoring_team_participant
        CHECK (
            first_scoring_team_id IS NULL
            OR first_scoring_team_id = team1_id
            OR first_scoring_team_id = team2_id
        ),

    CONSTRAINT ck_matches_winner_participant
        CHECK (
            winner_id IS NULL
            OR winner_id = team1_id
            OR winner_id = team2_id
        ),

    -- Indexes
    INDEX ix_matches_match_datetime (match_datetime),
    INDEX ix_matches_match_day (match_day),
    INDEX ix_matches_match_locked (match_locked),
    INDEX ix_matches_locked_datetime (match_locked, match_datetime),
    INDEX ix_matches_team1_id (team1_id),
    INDEX ix_matches_team2_id (team2_id),
    INDEX ix_matches_winner_id (winner_id),
    INDEX ix_matches_kick_off_team_id (kick_off_team_id),
    INDEX ix_matches_first_scoring_team_id (first_scoring_team_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
