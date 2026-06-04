CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,

    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    mobile_no VARCHAR(20) NOT NULL,

    password VARCHAR(255) NOT NULL,

    role ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    winner_team_id INT NULL DEFAULT NULL,
    runner_up_team_id INT NULL DEFAULT NULL,
    third_place_team_id INT NULL DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_winner_team
        FOREIGN KEY (winner_team_id)
        REFERENCES teams(id),

    CONSTRAINT fk_users_runner_up_team
        FOREIGN KEY (runner_up_team_id)
        REFERENCES teams(id),

    CONSTRAINT fk_users_third_place_team
        FOREIGN KEY (third_place_team_id)
        REFERENCES teams(id),

    INDEX ix_users_email (email),
    INDEX ix_users_role (role),
    INDEX ix_users_is_active (is_active),
    INDEX ix_users_winner_team_id (winner_team_id),
    INDEX ix_users_runner_up_team_id (runner_up_team_id),
    INDEX ix_users_third_place_team_id (third_place_team_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
