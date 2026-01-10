/*
delete from public.studentsgrades;
delete from public.students;


select * from public.students;
select * from public.studentsgrades;
*/

INSERT INTO public.students (studentid,studentfirstname,studentlastname,studentdob,studentbit,studentmsg) OVERRIDING SYSTEM VALUE
VALUES 
	('1','First Name1','last Name 1','2000-01-01',NULL,NULL),
	('2','First Name2','last Name 2','2000-02-02',NULL,NULL),
	('3','First Name3','last Name 3','2000-03-03',NULL,NULL),
	('4','First Name4','last Name 4','2000-04-04',NULL,NULL),
	('5','First Name5','last Name 5','2000-05-05',NULL,NULL);


INSERT INTO public.studentsgrades (studentgradeid ,studentid ,topic,gradeletter,comments)
VALUES
 (1 ,1 ,'math','A',NULL),
 (2 ,2 ,'math','C',NULL),
 (3 ,2 ,'english','C',NULL);
 
--------------------------changes for demo------------------------------------------------------------
alter table public.students add some_extra_col int NULL;


update public.studentsgrades set comments='some comment for 2'
where studentgradeid=2;

delete from public.studentsgrades 
where studentgradeid=3;

delete from public.students
where studentid=3;

INSERT INTO public.students (studentid,studentfirstname,studentlastname,studentdob,studentbit) OVERRIDING SYSTEM VALUE
VALUES 
	('6','First Name6','last Name 6','2000-06-06',NULL);