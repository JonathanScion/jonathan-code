DO $$ 
BEGIN

/*ALTER TABLE collateral.fixture ADD COLUMN geo_point GEOGRAPHY(Point, 4326);*/

ALTER TABLE collateral.fixture ADD COLUMN street_address VARCHAR(255);
ALTER TABLE collateral.fixture ADD COLUMN city VARCHAR(255);
ALTER TABLE collateral.fixture ADD COLUMN state CHAR(2);
ALTER TABLE collateral.fixture ADD COLUMN zip VARCHAR(10);
ALTER TABLE collateral.fixture ADD COLUMN county VARCHAR(255);
ALTER TABLE collateral.fixture ADD COLUMN country VARCHAR(255);

/*CREATE INDEX idx_fixture_geo_point ON collateral.fixture USING GIST (geo_point);*/

END $$;