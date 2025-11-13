#!/usr/bin/env node
/**
 * Script to check the coordinates embedded in a GeoTIFF file
 * Usage: node check-geotiff-coords.js <path-to-tiff-file>
 */

const { fromFile } = require('geotiff');
const fs = require('fs');

async function checkGeoTIFFCoordinates(filepath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filepath)) {
      console.error(`Error: File not found: ${filepath}`);
      process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`GeoTIFF Analysis: ${filepath}`);
    console.log('='.repeat(60));

    // Load the GeoTIFF
    const tiff = await fromFile(filepath);
    const image = await tiff.getImage();

    // Get basic properties
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const bitsPerSample = image.getBitsPerSample()[0] || 8;

    console.log(`\nBasic Info:`);
    console.log(`  Width:     ${width} pixels`);
    console.log(`  Height:    ${height} pixels`);
    console.log(`  Bands:     ${samplesPerPixel}`);
    console.log(`  Bit Depth: ${bitsPerSample}`);

    // Get geographic bounds
    const bbox = image.getBoundingBox();

    if (bbox && bbox.length === 4) {
      const [west, south, east, north] = bbox;

      console.log(`\nBounding Box:`);
      console.log(`  West:  ${west.toFixed(6)}`);
      console.log(`  East:  ${east.toFixed(6)}`);
      console.log(`  North: ${north.toFixed(6)}`);
      console.log(`  South: ${south.toFixed(6)}`);

      // Calculate center
      const centerLat = (north + south) / 2;
      const centerLon = (east + west) / 2;

      console.log(`\nCenter Point:`);
      console.log(`  Latitude:  ${centerLat.toFixed(6)}`);
      console.log(`  Longitude: ${centerLon.toFixed(6)}`);

      // Check if coordinates are in valid lat/lon range
      const isValidLatLon =
        south >= -90 && south <= 90 &&
        north >= -90 && north <= 90 &&
        west >= -180 && west <= 180 &&
        east >= -180 && east <= 180;

      console.log(`\nCoordinate System:`);
      if (isValidLatLon) {
        console.log(`  ✓ Valid Lat/Lon (WGS84) coordinates`);

        // Identify location
        console.log(`\nLocation Analysis:`);
        if (centerLat >= 34 && centerLat <= 36 && centerLon >= 32 && centerLon <= 35) {
          console.log(`  ✓ This appears to be CYPRUS`);
        } else if (centerLat >= 42 && centerLat <= 45 && centerLon >= -73 && centerLon <= -70) {
          console.log(`  ✗ This appears to be NEW HAMPSHIRE, USA`);
        } else if (centerLat >= 40 && centerLat <= 41 && centerLon >= -75 && centerLon <= -73) {
          console.log(`  ✗ This appears to be NEW YORK/NEW JERSEY area`);
        } else {
          console.log(`  Location: Other (${formatLocation(centerLat, centerLon)})`);
        }
      } else {
        console.log(`  ✗ Coordinates are in a projected coordinate system`);
        console.log(`  → You may need to transform them to Lat/Lon`);
        console.log(`  → The coordinates shown are NOT latitude/longitude`);
      }

      // Show what this will look like in your app
      console.log(`\n${'='.repeat(60)}`);
      console.log(`What you'll see in your app:`);
      console.log(`  Coordinates: ${centerLat.toFixed(4)}, ${centerLon.toFixed(4)}`);
      if (isValidLatLon) {
        console.log(`  Map URL: https://www.google.com/maps/@${centerLat},${centerLon},8z`);
      }
      console.log('='.repeat(60));

    } else {
      console.log(`\n✗ No geographic bounding box found in this file`);
      console.log(`  This file may not have coordinate information embedded`);
    }

    console.log('');

  } catch (error) {
    console.error(`\nError reading GeoTIFF: ${error.message}`);
    console.error(`\nMake sure you have geotiff installed:`);
    console.error(`  cd ${__dirname}`);
    console.error(`  npm install geotiff`);
    process.exit(1);
  }
}

function formatLocation(lat, lon) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

// Main
if (require.main === module) {
  if (process.argv.length < 3) {
    console.log('Usage: node check-geotiff-coords.js <path-to-tiff-file>');
    console.log('\nExample:');
    console.log('  node check-geotiff-coords.js C:\\path\\to\\cyprus.tif');
    console.log('  node check-geotiff-coords.js "C:\\path with spaces\\image.tif"');
    process.exit(1);
  }

  const filepath = process.argv[2];
  checkGeoTIFFCoordinates(filepath);
}

module.exports = { checkGeoTIFFCoordinates };
