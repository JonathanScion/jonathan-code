-- 2024/12/18 - Clare added lookups for the following lookup type

-- PersonalPropertyVehicleMake = 22,


DO $$
BEGIN

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Acura' AS label, 0 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Alfo Romero' AS label, 5 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Altec' AS label, 10 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Aston Martin' AS label, 20 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Audi' AS label, 30 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Bandit' AS label, 40 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Bentley' AS label, 50 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Bluebird' AS label, 60 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'BMW' AS label, 70 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Bugatti' AS label, 80 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Buick' AS label, 100 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Cadillac' AS label, 110 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Cargotec' AS label, 120 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Caterpillar' AS label, 130 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Chevrolet' AS label, 140 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Chrysler' AS label, 150 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Cottrell' AS label, 160 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Daewood' AS label, 170 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Daimler' AS label, 180 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Dodge' AS label, 190 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'East' AS label, 220 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Eldorado' AS label, 230 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Ferrai' AS label, 240 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Fiat' AS label, 250 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Fontaine' AS label, 260 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Ford' AS label, 270 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Frieghtliner' AS label, 280 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Fruehauf' AS label, 290 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'General Motors' AS label, 300 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Genesis' AS label, 305 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'GMC Truck' AS label, 310 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'GMC' AS label, 315 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Great Dane' AS label, 320 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Heil' AS label, 330 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Hino' AS label, 340 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Honda' AS label, 350 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Hummer' AS label, 360 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Hyundai' AS label, 370 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'IC' AS label, 380 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Infiniti' AS label, 390 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'International' AS label, 400 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Isuzu' AS label, 410 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Jaguar' AS label, 420 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Jeep' AS label, 430 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Kenworth' AS label, 450 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Kia' AS label, 460 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Lamborghni' AS label, 470 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Land Rover' AS label, 480 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Lexus' AS label, 500 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Lincoln' AS label, 510 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Mack' AS label, 520 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Manac' AS label, 530 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Maserati' AS label, 540 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Mazda' AS label, 550 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'MCI' AS label, 560 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Mercedez Benz' AS label, 570 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Mitsubishi' AS label, 610 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Nissan' AS label, 620 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Peterbilt' AS label, 640 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Polestar' AS label, 650 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Pontiac' AS label, 660 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Porsche' AS label, 680 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Prevost' AS label, 690 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Ram' AS label, 700 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Rivian' AS label, 705 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Saab' AS label, 710 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Rolls Royce' AS label, 715 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Saturn' AS label, 720 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Scion' AS label, 725 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Smart' AS label, 730 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Sterling' AS label, 740 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Stoughton' AS label, 750 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Strick' AS label, 760 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Subaru' AS label, 770 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Talbert' AS label, 790 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Tesla' AS label, 795 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Thomas' AS label, 800 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Toyota' AS label, 810 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Trail King' AS label, 820 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Trailmobile' AS label, 830 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Transcraft' AS label, 840 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Utility' AS label, 850 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Vanguard' AS label, 860 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Volkswagen' AS label, 870 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Volvo' AS label, 880 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Wabash National' AS label, 890 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Wanco' AS label, 900 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Western Star' AS label, 910 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'White' AS label, 920 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Boat' AS label, 950 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Bus' AS label, 960 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Truck' AS label, 970 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Trailer' AS label, 980 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Vehicle' AS label, 990 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Converted Not Found' AS label, 998 AS value, 22 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Converted Other' AS label, 999 AS value, 22 AS type, CAST(NULL AS INTEGER)

) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);
END $$; 
