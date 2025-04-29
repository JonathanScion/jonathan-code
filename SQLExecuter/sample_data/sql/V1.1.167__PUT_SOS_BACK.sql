DO $$ 
BEGIN

--Adding back because we have a couple of active parcels that are using the S.O.S. county code, so we need for migration purposes

-- Restore all S.O.S. entries to the lookup_state_counties table
INSERT INTO collateral.lookup_state_counties (county_code, county_description, state_code)
VALUES 
('01000', 'S.O.S.', 'AL'),
('02000', 'S.O.S.', 'AK'),
('04000', 'S.O.S.', 'AZ'),
('05000', 'S.O.S.', 'AR'),
('06000', 'S.O.S.', 'CA'),
('08000', 'S.O.S.', 'CO'),
('09000', 'S.O.S.', 'CT'),
('10000', 'S.O.S.', 'DE'),
('11000', 'S.O.S.', 'DC'),
('12000', 'S.O.S.', 'FL'),
('13000', 'S.O.S.', 'GA'),
('15000', 'S.O.S.', 'HI'),
('16000', 'S.O.S.', 'ID'),
('17000', 'S.O.S.', 'IL'),
('18000', 'S.O.S.', 'IN'),
('19000', 'S.O.S.', 'IA'),
('20000', 'S.O.S.', 'KS'),
('21000', 'S.O.S.', 'KY'),
('22000', 'S.O.S.', 'LA'),
('23000', 'S.O.S.', 'ME'),
('24000', 'S.O.S.', 'MD'),
('25000', 'S.O.S.', 'MA'),
('26000', 'S.O.S.', 'MI'),
('27000', 'S.O.S.', 'MN'),
('28000', 'S.O.S.', 'MS'),
('29000', 'S.O.S.', 'MO'),
('30000', 'S.O.S.', 'MT'),
('31000', 'S.O.S.', 'NE'),
('32000', 'S.O.S.', 'NV'),
('33000', 'S.O.S.', 'NH'),
('34000', 'S.O.S.', 'NJ'),
('35000', 'S.O.S.', 'NM'),
('36000', 'S.O.S.', 'NY'),
('37000', 'S.O.S.', 'NC'),
('38000', 'S.O.S.', 'ND'),
('39000', 'S.O.S.', 'OH'),
('40000', 'S.O.S.', 'OK'),
('41000', 'S.O.S.', 'OR'),
('42000', 'S.O.S.', 'PA'),
('44000', 'S.O.S.', 'RI'),
('45000', 'S.O.S.', 'SC'),
('46000', 'S.O.S.', 'SD'),
('47000', 'S.O.S.', 'TN'),
('48000', 'S.O.S.', 'TX'),
('49000', 'S.O.S.', 'UT'),
('50000', 'S.O.S.', 'VT'),
('51000', 'S.O.S.', 'VA'),
('53000', 'S.O.S.', 'WA'),
('54000', 'S.O.S.', 'WV'),
('55000', 'S.O.S.', 'WI'),
('56000', 'S.O.S.', 'WY');


END $$;