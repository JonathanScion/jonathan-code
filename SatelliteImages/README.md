# EOI Space - Satellite Imagery Management Platform

![Platform Banner](https://via.placeholder.com/1200x300/2ea3f2/ffffff?text=EOI+Space+Satellite+Platform)

A comprehensive, production-ready satellite imagery management and cataloging system built with React, TypeScript, and AWS serverless technologies. Designed to match the professional aesthetic of [EOI Space](https://eoi.space).

## 🌟 Features

### Core Capabilities
- 📤 **Drag-and-drop upload** for TIFF/GeoTIFF files
- 🗺️ **Interactive maps** with Leaflet
- 🌍 **3D globe visualization** (Cesium-ready)
- 🔍 **Advanced search** and filtering
- 📊 **Analytics dashboard** with charts
- 📁 **Collections** for organizing images
- 🔄 **Image comparison** side-by-side
- 📍 **Geospatial metadata** extraction
- 🏷️ **Tagging system** for categorization
- 📈 **Real-time upload progress**

### Technical Highlights
- ⚡ Serverless AWS architecture
- 🔒 Secure S3 storage with presigned URLs
- 💾 DynamoDB for fast metadata queries
- 🎨 EOI Space-branded UI (matching eoi.space)
- 📱 Fully responsive design
- 🚀 Automated deployment with GitHub Actions
- 🏗️ Infrastructure as Code with Terraform

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Development](#development)
- [Features](#features)
- [Technologies](#technologies)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **AWS Account** with CLI configured
- **Terraform** 1.5+
- **Git**

### One-Command Deployment (Unix/Linux/Mac)

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### One-Command Deployment (Windows)

```powershell
.\scripts\deploy.ps1
```

### Manual Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 📚 Documentation

- **[FEATURES.md](FEATURES.md)** - Complete feature documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment guide
- **[terraform/README.md](terraform/README.md)** - Infrastructure details

## 🏛️ Architecture

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│           S3 Static Website              │
│       (React SPA - Frontend)             │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         API Gateway (REST API)           │
└──────────────┬───────────────────────────┘
               │
       ┌───────┴───────┬──────────┐
       ▼               ▼          ▼
┌─────────────┐  ┌──────────┐  ┌────────┐
│   Lambda    │  │  Lambda  │  │ Lambda │
│  (Upload)   │  │ (Search) │  │  (...)  │
└──────┬──────┘  └─────┬────┘  └────┬───┘
       │               │            │
       ▼               ▼            ▼
┌──────────────────────────────────────────┐
│              DynamoDB                    │
│      (Images & Collections Tables)      │
└──────────────────────────────────────────┘

       ┌──────────────┐
       │  S3 Bucket   │
       │   (Images)   │
       └──────────────┘
```

## 📁 Project Structure

```
satellite-imagery-platform/
├── frontend/              # React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── lib/          # Utilities, API, state
│   │   └── main.tsx      # Entry point
│   ├── package.json
│   └── vite.config.ts
│
├── backend/              # Lambda functions
│   ├── src/
│   │   ├── handlers/     # Lambda handlers
│   │   └── lib/          # Utilities
│   ├── package.json
│   └── tsconfig.json
│
├── shared/               # Shared TypeScript types
│   └── src/
│       └── types.ts
│
├── terraform/            # Infrastructure as Code
│   ├── main.tf
│   ├── s3.tf
│   ├── dynamodb.tf
│   ├── lambda.tf
│   ├── api-gateway.tf
│   └── outputs.tf
│
├── .github/
│   └── workflows/        # CI/CD pipelines
│       ├── ci.yml
│       └── deploy.yml
│
├── scripts/              # Deployment scripts
│   ├── deploy.sh         # Unix/Linux/Mac
│   └── deploy.ps1        # Windows
│
├── FEATURES.md           # Feature documentation
├── DEPLOYMENT.md         # Deployment guide
└── README.md            # This file
```

## 🎨 Features Overview

### Upload & Management
- Drag-and-drop interface with progress tracking
- Automatic metadata extraction from GeoTIFF
- Thumbnail generation
- Support for multi-band imagery
- File size up to 500MB per image

### Gallery & Browsing
- **Grid View**: Card layout with thumbnails
- **List View**: Detailed metadata display
- **Map View**: Interactive Leaflet map
- **Globe View**: 3D Cesium visualization

### Search & Filtering
- Full-text search across titles, descriptions, tags
- Advanced filters:
  - Date range (capture or upload)
  - Geographic bounds
  - Cloud coverage
  - Satellite name
  - Resolution range
  - Tags

### Analytics Dashboard
- Total images count
- Storage usage
- Coverage area (km²)
- Upload trends (monthly)
- Tag distribution (pie chart)
- Satellite breakdown (bar chart)

### Collections
- Group related images
- Add/remove images
- Share collections
- Public/private visibility

### Image Details
- High-resolution viewer
- Interactive location map
- Complete metadata display
- Edit title, description, tags
- Download original file
- Delete image
- Add to collection
- Compare with another image

## 🛠️ Technologies

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling (EOI Space theme)
- **TanStack Query** - Server state management
- **Jotai** - Client state management
- **Framer Motion** - Animations
- **React Router** - Navigation
- **Leaflet** - 2D maps
- **Cesium** - 3D globe (ready)
- **Recharts** - Data visualization

### Backend
- **AWS Lambda** - Serverless functions
- **Node.js 20** - Runtime
- **TypeScript** - Type safety
- **AWS SDK v3** - AWS services
- **Sharp** - Image processing
- **GeoTIFF.js** - Metadata extraction

### Infrastructure
- **AWS S3** - Object storage
- **AWS DynamoDB** - NoSQL database
- **AWS API Gateway** - REST API
- **AWS CloudWatch** - Logging
- **Terraform** - Infrastructure as Code

### DevOps
- **GitHub Actions** - CI/CD
- **ESLint** - Code linting
- **npm workspaces** - Monorepo

## 🎨 Design

The UI is designed to match the professional aesthetic of [eoi.space](https://eoi.space):

- **Primary Color**: `#2ea3f2` (EOI Space blue)
- **Font**: Open Sans (300, 400, 600, 700, 800)
- **Style**: Clean, minimal, corporate
- **Components**: Cards with subtle shadows, smooth transitions
- **Responsive**: Mobile, tablet, desktop

## 🚢 Deployment

### GitHub Actions (Recommended)

1. Fork the repository
2. Set GitHub secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
3. Push to `main` branch
4. GitHub Actions handles the rest!

### Manual Deployment

```bash
# 1. Install dependencies
npm run install:all

# 2. Build everything
cd shared && npm run build
cd ../backend && npm run build

# 3. Deploy infrastructure
cd ../terraform
terraform init
terraform apply

# 4. Update Lambda functions
# (See DEPLOYMENT.md for details)

# 5. Build and deploy frontend
cd ../frontend
npm run build
aws s3 sync dist/ s3://$(cd ../terraform && terraform output -raw frontend_bucket_name)/
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

## 💻 Development

### Install Dependencies

```bash
npm run install:all
```

### Run Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

### Build Backend

```bash
cd backend
npm run build
```

### Run Tests

```bash
npm test
```

### Lint Code

```bash
cd frontend
npm run lint
```

## 📊 Cost Estimation

### Demo Usage (100 images, 100 requests/day)
- **Total**: ~$3-5/month

### Production Usage (10,000 images, 10,000 requests/day)
- **Total**: ~$160/month

Detailed breakdown in [DEPLOYMENT.md](DEPLOYMENT.md).

## 🔐 Security

- S3 encryption at rest (AES-256)
- HTTPS/TLS for data in transit
- IAM role-based access control
- Presigned URLs with expiration
- Public access blocked on images bucket
- Security best practices followed

## 📈 Performance

- **Frontend**: Code splitting, lazy loading, caching
- **Backend**: Concurrent Lambda, DynamoDB indexes
- **Storage**: S3 transfer acceleration ready
- **CDN**: CloudFront integration ready

## 🤝 Contributing

This is a demo project. For production use:

1. Add authentication (AWS Cognito)
2. Add CloudFront CDN
3. Add custom domain
4. Enable CloudWatch alarms
5. Add comprehensive tests
6. Add API rate limiting

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **EOI Space** - Design inspiration and branding
- **AWS** - Cloud infrastructure
- **Terraform** - Infrastructure as Code
- **React** - UI framework
- **Leaflet** - Mapping library
- **Cesium** - 3D globe visualization

## 📞 Support

For questions about:
- **This platform**: Check the documentation files
- **EOI Space**: Visit [eoi.space](https://eoi.space)
- **AWS issues**: Review CloudWatch logs
- **Terraform**: Check `terraform/README.md`

## 🎯 Next Steps

After deployment:

1. **Open your application** using the frontend URL
2. **Upload a satellite image** (TIFF/GeoTIFF)
3. **Explore the features**:
   - View on map
   - Add to collection
   - Compare images
   - Check analytics
4. **Customize** the design to your needs
5. **Add authentication** for production use

---

**Built with ❤️ for EOI Space**

**Demo Platform | Satellite Imagery Management**

For more information, visit [eoi.space](https://eoi.space)
