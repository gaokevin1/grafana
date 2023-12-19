-- test all numeric postgres data types
CREATE TEMPORARY TABLE tbl (
    i16 smallint,
    i16nn smallint NOT NULL,
    i32 integer,
    i32nn integer NOT NULL,
    i64 bigint,
    i64nn bigint NOT NULL,
    n numeric(6, 2),
    nnn numeric(6,2) NOT NULL,
    f32 real,
    f32nn real NOT NULL,
    f64 double precision,
    f64nn double precision NOT NULL
);

INSERT INTO tbl (i16, i16nn, i32, i32nn, i64, i64nn, n, nnn, f32, f32nn, f64, f64nn) VALUES
(1, 2, 3, 4, 5, 6, 456.78, 345.67, 123.45, 234.56, 345.67, 456.78),
(NULL, 22, NULL, 44, NULL, 66, NULL, 2345.67, NULL, 1234.56, NULL, 3456.78);