#!/usr/bin/env python3
"""
Script to check the coordinates embedded in a GeoTIFF file
Usage: python check-geotiff-coords.py <path-to-tiff-file>
"""

import sys
from osgeo import gdal, osr

def check_geotiff_coordinates(filepath):
    """Extract and display coordinate information from a GeoTIFF file"""

    # Open the file
    dataset = gdal.Open(filepath)
    if dataset is None:
        print(f"Error: Could not open file '{filepath}'")
        print("Make sure GDAL is installed: pip install gdal")
        return

    print(f"\n=== GeoTIFF Analysis: {filepath} ===\n")

    # Get basic info
    print(f"Width: {dataset.RasterXSize} pixels")
    print(f"Height: {dataset.RasterYSize} pixels")
    print(f"Bands: {dataset.RasterCount}")

    # Get geotransform
    geotransform = dataset.GetGeoTransform()
    if geotransform:
        print(f"\nGeoTransform:")
        print(f"  Origin: ({geotransform[0]}, {geotransform[3]})")
        print(f"  Pixel Size: ({geotransform[1]}, {geotransform[5]})")

    # Get projection
    projection = dataset.GetProjection()
    if projection:
        srs = osr.SpatialReference(wkt=projection)
        print(f"\nProjection: {srs.GetAttrValue('AUTHORITY', 1)} - {srs.GetName()}")

        # Check if it's lat/lon (EPSG:4326) or needs transformation
        if srs.IsGeographic():
            print("  Type: Geographic (Lat/Lon)")
        else:
            print("  Type: Projected (needs transformation to Lat/Lon)")

    # Calculate bounding box
    width = dataset.RasterXSize
    height = dataset.RasterYSize

    if geotransform:
        minx = geotransform[0]
        maxy = geotransform[3]
        maxx = minx + width * geotransform[1]
        miny = maxy + height * geotransform[5]

        print(f"\nBounding Box (in file's coordinate system):")
        print(f"  West:  {minx}")
        print(f"  East:  {maxx}")
        print(f"  North: {maxy}")
        print(f"  South: {miny}")

        # Calculate center
        center_x = (minx + maxx) / 2
        center_y = (miny + maxy) / 2

        print(f"\nCenter Point (in file's coordinate system):")
        print(f"  X: {center_x}")
        print(f"  Y: {center_y}")

        # If projected, transform to lat/lon
        if projection and srs and not srs.IsGeographic():
            print("\n--- Transforming to Lat/Lon (EPSG:4326) ---")

            # Create transformation
            target_srs = osr.SpatialReference()
            target_srs.ImportFromEPSG(4326)
            transform = osr.CoordinateTransformation(srs, target_srs)

            # Transform corners
            sw = transform.TransformPoint(minx, miny)
            ne = transform.TransformPoint(maxx, maxy)

            print(f"\nBounding Box (Lat/Lon):")
            print(f"  West:  {sw[0]:.6f}")
            print(f"  East:  {ne[0]:.6f}")
            print(f"  North: {ne[1]:.6f}")
            print(f"  South: {sw[1]:.6f}")

            # Transform center
            center_latlon = transform.TransformPoint(center_x, center_y)
            print(f"\nCenter Point (Lat/Lon):")
            print(f"  Latitude:  {center_latlon[1]:.6f}")
            print(f"  Longitude: {center_latlon[0]:.6f}")

            # Determine location
            lat, lon = center_latlon[1], center_latlon[0]
            if 34 <= lat <= 36 and 32 <= lon <= 35:
                print(f"  Location: This appears to be in CYPRUS ✓")
            elif 42 <= lat <= 45 and -73 <= lon <= -70:
                print(f"  Location: This appears to be in NEW HAMPSHIRE")
            else:
                print(f"  Location: Other")

        elif srs and srs.IsGeographic():
            # Already in lat/lon
            print(f"\n--- Already in Lat/Lon format ---")
            print(f"\nThese ARE the Lat/Lon coordinates:")
            print(f"  Latitude:  {center_y:.6f}")
            print(f"  Longitude: {center_x:.6f}")

            # Determine location
            if 34 <= center_y <= 36 and 32 <= center_x <= 35:
                print(f"  Location: This appears to be in CYPRUS ✓")
            elif 42 <= center_y <= 45 and -73 <= center_x <= -70:
                print(f"  Location: This appears to be in NEW HAMPSHIRE")
            else:
                print(f"  Location: Other")

    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check-geotiff-coords.py <path-to-tiff-file>")
        print("\nExample:")
        print("  python check-geotiff-coords.py C:\\path\\to\\cyprus.tif")
        sys.exit(1)

    filepath = sys.argv[1]
    check_geotiff_coordinates(filepath)
