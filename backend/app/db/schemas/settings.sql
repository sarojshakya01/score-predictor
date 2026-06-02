CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    friendly_name VARCHAR(100) NOT NULL,
    value JSON NOT NULL,

    -- TimestampMixin fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT ck_settings_name_not_empty
        CHECK (CHAR_LENGTH(name) > 0),

    CONSTRAINT ck_settings_friendly_name_not_empty
        CHECK (CHAR_LENGTH(friendly_name) > 0),

    -- Index
    INDEX ix_settings_name (name)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
