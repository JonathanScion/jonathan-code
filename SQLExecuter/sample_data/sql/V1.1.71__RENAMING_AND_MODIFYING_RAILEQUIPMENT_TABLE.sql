DO $$
BEGIN

-- Rename existing tables
ALTER TABLE collateral.railroad_car_lessee
RENAME TO collateral_titled_property_railroad_cars_lessee;

ALTER TABLE collateral.railroad_car_rail_equipments
RENAME TO collateral_titled_property_railroad_cars_rail_equipments;

-- Add new columns to collateral_titled_property_railroad_cars_lessee
ALTER TABLE collateral.collateral_titled_property_railroad_cars_lessee
ADD COLUMN collateral_titled_property_railroad_cars_id INTEGER NOT NULL,
ADD CONSTRAINT fk_collateral_titled_property_railroad_cars
    FOREIGN KEY (collateral_titled_property_railroad_cars_id)
    REFERENCES collateral.collateral_titled_property_railroad_cars (collateral_titled_property_railroad_cars_id)
    ON DELETE CASCADE;

-- Add new columns to collateral_titled_property_railroad_cars_rail_equipments
ALTER TABLE collateral.collateral_titled_property_railroad_cars_rail_equipments
ADD COLUMN collateral_titled_property_railroad_cars_id INTEGER NOT NULL,
ADD CONSTRAINT fk_collateral_titled_property_railroad_cars
    FOREIGN KEY (collateral_titled_property_railroad_cars_id)
    REFERENCES collateral.collateral_titled_property_railroad_cars (collateral_titled_property_railroad_cars_id)
    ON DELETE CASCADE;

END $$;