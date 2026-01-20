# Demo Images for Satellite Intelligence Platform

High-resolution satellite imagery from Maxar Open Data Program for demonstration purposes.

## Images Included

### 1. LA-Fire-2025-before.tif
- **Event:** Los Angeles Wildfires
- **Date:** December 14, 2024 (BEFORE fires)
- **Location:** Palisades area, Los Angeles, CA
- **Source:** WorldView-2 satellite
- **Use For:** Change detection baseline

### 2. LA-Fire-2025-after.tif
- **Event:** Los Angeles Wildfires
- **Date:** January 9, 2025 (AFTER fires)
- **Location:** Palisades area, Los Angeles, CA
- **Source:** WorldView satellite
- **Use For:** Disaster detection, change detection comparison

### 3. Maui-Lahaina-Fire-2023.tif
- **Event:** Maui Wildfires
- **Date:** August 12, 2023
- **Location:** Lahaina, Maui, Hawaii
- **Source:** WorldView satellite
- **Use For:** Disaster detection (severe fire damage visible)
- **Note:** Shows devastation of historic Lahaina town

### 4. Spain-Flood-2024.tif
- **Event:** Valencia Floods
- **Date:** October 31, 2024
- **Location:** Valencia region, Spain
- **Source:** WorldView satellite
- **Use For:** Disaster detection (flood damage)

## Demo Scenarios

### Scenario A: Fire Disaster Detection
1. Upload `Maui-Lahaina-Fire-2023.tif`
2. Run AI Analysis → Disaster Detection
3. Expected result: Fire detected, HIGH severity

### Scenario B: Change Detection (Before/After)
1. Upload `LA-Fire-2025-before.tif`
2. Upload `LA-Fire-2025-after.tif`
3. Go to Compare page
4. Run AI Change Detection
5. Expected result: Significant burn damage identified

### Scenario C: Flood Detection
1. Upload `Spain-Flood-2024.tif`
2. Run AI Analysis → Disaster Detection
3. Expected result: Flood detected, visible water damage

### Scenario D: Land Use Classification
1. Upload any image
2. Run AI Analysis → Land Use Classification
3. Expected result: Breakdown of urban/vegetation/water percentages

## License

These images are provided under **CC-BY-NC-4.0** license by Maxar Open Data Program.
- Attribution required
- Non-commercial use only
- More info: https://www.maxar.com/open-data

## Source

Downloaded from Maxar Open Data STAC Catalog:
- Catalog: https://maxar-opendata.s3.amazonaws.com/events/catalog.json
- GitHub: https://github.com/opengeos/maxar-open-data
