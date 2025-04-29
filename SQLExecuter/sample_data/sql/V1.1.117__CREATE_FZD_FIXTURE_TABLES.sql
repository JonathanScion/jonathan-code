DO $$ 
BEGIN

CREATE TABLE collateral.flood_zone_request_fixtures (
    flood_zone_request_id INT REFERENCES collateral.flood_zone_requests(flood_zone_request_id) ON DELETE CASCADE,
    fixture_id INT REFERENCES collateral.fixture(fixture_id) ON DELETE CASCADE,
    PRIMARY KEY (flood_zone_request_id, fixture_id)
);

CREATE TABLE collateral.flood_zone_determination_fixtures (
    flood_zone_determination_id INT REFERENCES collateral.flood_zone_determinations(flood_zone_determination_id) ON DELETE CASCADE,
    fixture_id INT REFERENCES collateral.fixture(fixture_id) ON DELETE CASCADE,
    PRIMARY KEY (flood_zone_determination_id, fixture_id)
);

END $$;