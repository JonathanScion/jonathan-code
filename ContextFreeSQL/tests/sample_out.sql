CREATE TABLE public.studentgrades
(
studentid  integer  NOT NULL
subject  character varying  NOT NULL
grade  smallint  NOT NULL
studentgradeid  integer  NOT NULL
);
ALTER TABLE public.studentgrades ADD CONSTRAINT studentgrades_pkey PRIMARY KEY
(
studentgradeid
)
;
CREATE INDEX idx_student_text
ON public.studentgrades
(
subject
)
;
ALTER TABLE public.studentgrades ADD
CONSTRAINT unq_studentid_subj UNIQUE 
(
subject,
grade
)
;
ALTER TABLE public.studentgrades ADD CONSTRAINT fk_studentgrades_students FOREIGN KEY
(
studentid
)
REFERENCES public.students
(
studentid
)
;
ALTER TABLE public.studentgrades ALTER COLUMN grade SET DEFAULT 0;
ALTER TABLE public.studentgrades ALTER COLUMN subject SET DEFAULT 'math'::character varying;