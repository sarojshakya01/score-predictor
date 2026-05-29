CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    `group` VARCHAR(20) NOT NULL,
    fifa_code VARCHAR(3) NOT NULL,
    `rank` INT NOT NULL,

    -- TimestampMixin fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT ck_teams_name_not_empty
        CHECK (CHAR_LENGTH(name) > 0),

    CONSTRAINT ck_teams_group_not_empty
        CHECK (CHAR_LENGTH(`group`) > 0),

    CONSTRAINT ck_teams_fifa_code_length
        CHECK (CHAR_LENGTH(fifa_code) BETWEEN 2 AND 3),

    -- Indexes
    INDEX ix_teams_name (name),
    INDEX ix_teams_group (`group`),
    INDEX ix_teams_fifa_code (fifa_code)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;