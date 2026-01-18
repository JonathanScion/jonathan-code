import { Pool } from 'pg';

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'satellite_images',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export { pool };

// Initialize database tables
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        filename VARCHAR(500) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        captured_at TIMESTAMP WITH TIME ZONE,

        -- Geographic metadata
        bounds_north DOUBLE PRECISION,
        bounds_south DOUBLE PRECISION,
        bounds_east DOUBLE PRECISION,
        bounds_west DOUBLE PRECISION,
        center_lat DOUBLE PRECISION,
        center_lon DOUBLE PRECISION,
        projection VARCHAR(100),

        -- Technical metadata
        resolution DOUBLE PRECISION,
        width INTEGER,
        height INTEGER,
        bands INTEGER,
        bit_depth INTEGER,

        -- Satellite information
        satellite_name VARCHAR(100),
        sensor_type VARCHAR(100),
        cloud_coverage DOUBLE PRECISION,

        -- User metadata
        title VARCHAR(255),
        description TEXT,
        tags TEXT[], -- PostgreSQL array
        collection_ids UUID[],

        -- Processing
        thumbnail_path VARCHAR(500),
        preview_path VARCHAR(500),
        status VARCHAR(20) DEFAULT 'UPLOADING',

        -- Annotations and analysis stored as JSONB
        annotations JSONB,
        analysis JSONB,

        -- NASA enrichment data
        nasa_enrichment JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
      CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);

      CREATE TABLE IF NOT EXISTS collections (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_ids UUID[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_public BOOLEAN DEFAULT FALSE,
        share_token VARCHAR(100)
      );

      CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);

      CREATE TABLE IF NOT EXISTS requests (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,

        -- Location details
        target_lat DOUBLE PRECISION NOT NULL,
        target_lon DOUBLE PRECISION NOT NULL,
        target_bounds_north DOUBLE PRECISION,
        target_bounds_south DOUBLE PRECISION,
        target_bounds_east DOUBLE PRECISION,
        target_bounds_west DOUBLE PRECISION,
        location_name VARCHAR(255),

        -- Scheduling details
        requested_start_date DATE NOT NULL,
        requested_end_date DATE NOT NULL,
        scheduled_date DATE,
        completed_date DATE,

        -- Request metadata
        priority VARCHAR(20) DEFAULT 'MEDIUM',
        status VARCHAR(20) DEFAULT 'PENDING',
        title VARCHAR(255) NOT NULL,
        description TEXT,

        -- Technical requirements
        min_resolution DOUBLE PRECISION,
        max_cloud_coverage DOUBLE PRECISION,
        preferred_satellites TEXT[],

        -- Recurrence
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern VARCHAR(20),

        -- Results
        captured_image_ids UUID[],

        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        -- Notes
        notes TEXT,
        cancel_reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    `);

    console.log('Database tables initialized successfully');
  } finally {
    client.release();
  }
}

// Helper to convert database row to SatelliteImage
export function rowToImage(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    s3Key: row.file_path, // Keep for compatibility with frontend
    s3Bucket: 'local', // Keep for compatibility
    filePath: row.file_path,
    fileSize: parseInt(row.file_size),
    uploadedAt: row.uploaded_at?.toISOString(),
    capturedAt: row.captured_at?.toISOString(),
    bounds: row.bounds_north !== null ? {
      north: row.bounds_north,
      south: row.bounds_south,
      east: row.bounds_east,
      west: row.bounds_west,
    } : undefined,
    centerPoint: row.center_lat !== null ? {
      lat: row.center_lat,
      lon: row.center_lon,
    } : undefined,
    projection: row.projection,
    resolution: row.resolution,
    width: row.width,
    height: row.height,
    bands: row.bands,
    bitDepth: row.bit_depth,
    satelliteName: row.satellite_name,
    sensorType: row.sensor_type,
    cloudCoverage: row.cloud_coverage,
    title: row.title,
    description: row.description,
    tags: row.tags,
    collectionIds: row.collection_ids,
    thumbnailUrl: row.thumbnail_path,
    previewUrl: row.preview_path,
    status: row.status,
    annotations: row.annotations,
    analysis: row.analysis,
    nasaEnrichment: row.nasa_enrichment,
  };
}

// Helper to convert database row to Collection
export function rowToCollection(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    imageIds: row.image_ids || [],
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
    isPublic: row.is_public,
    shareToken: row.share_token,
  };
}

// Helper to convert database row to ImagingRequest
export function rowToRequest(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    targetLocation: {
      lat: row.target_lat,
      lon: row.target_lon,
    },
    targetBounds: row.target_bounds_north !== null ? {
      north: row.target_bounds_north,
      south: row.target_bounds_south,
      east: row.target_bounds_east,
      west: row.target_bounds_west,
    } : undefined,
    locationName: row.location_name,
    requestedStartDate: row.requested_start_date?.toISOString().split('T')[0],
    requestedEndDate: row.requested_end_date?.toISOString().split('T')[0],
    scheduledDate: row.scheduled_date?.toISOString().split('T')[0],
    completedDate: row.completed_date?.toISOString().split('T')[0],
    priority: row.priority,
    status: row.status,
    title: row.title,
    description: row.description,
    minResolution: row.min_resolution,
    maxCloudCoverage: row.max_cloud_coverage,
    preferredSatellites: row.preferred_satellites,
    isRecurring: row.is_recurring,
    recurrencePattern: row.recurrence_pattern,
    capturedImageIds: row.captured_image_ids,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
    notes: row.notes,
    cancelReason: row.cancel_reason,
  };
}
