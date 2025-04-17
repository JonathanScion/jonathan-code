CREATE TABLE public.students
(
    studentid integer NOT NULL,
    studentfirstname character varying(100) COLLATE pg_catalog."default" NOT NULL,
    studentlastname character varying(100) COLLATE pg_catalog."default" NOT NULL DEFAULT 'Scion'::character varying,
    studentdob timestamp without time zone,
    sideoneonly integer,
    CONSTRAINT students_pkey PRIMARY KEY (studentid)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.students
    OWNER to postgres;
-- Index: students_idx

-- DROP INDEX IF EXISTS public.students_idx;

CREATE UNIQUE INDEX IF NOT EXISTS students_idx
    ON public.students USING btree
    (studentfirstname COLLATE pg_catalog."default" ASC NULLS LAST, studentlastname COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;