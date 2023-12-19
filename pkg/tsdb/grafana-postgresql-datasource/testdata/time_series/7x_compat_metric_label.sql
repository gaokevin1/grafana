CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v double precision,
    metric text
);

INSERT INTO tbl ("time", v, metric) VALUES
('2023-12-21 11:30:03 UTC', 10, 'a'),
('2023-12-21 11:30:03 UTC', 15, 'b'),
('2023-12-21 11:31:03 UTC', 20, 'a'),
('2023-12-21 11:31:03 UTC', 25, 'b'),
('2023-12-21 11:32:03 UTC', 30, 'a'),
('2023-12-21 11:32:03 UTC', 35, 'b'),
('2023-12-21 11:33:03 UTC', 40, 'a'),
('2023-12-21 11:33:03 UTC', 45, 'b'),
('2023-12-21 11:34:03 UTC', 50, 'a'),
('2023-12-21 11:34:03 UTC', 55, 'b');