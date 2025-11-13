#!/bin/bash

# EOI Space Satellite Platform - Deployment Script
# This script automates the deployment process

set -e  # Exit on error

echo "🚀 EOI Space Satellite Platform - Deployment"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is required but not installed.${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is required but not installed.${NC}" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI is required but not installed.${NC}" >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo -e "${RED}❌ Terraform is required but not installed.${NC}" >&2; exit 1; }

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

cd shared && npm install && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Build shared types
echo "🔨 Building shared types..."
cd shared
npm run build
cd ..
echo -e "${GREEN}✅ Shared types built${NC}"
echo ""

# Build backend
echo "🔨 Building backend..."
cd backend
npm run build

# Package Lambda
echo "📦 Packaging Lambda functions..."
rm -rf dist-package lambda-deployment.zip
mkdir -p dist-package
cp -r dist node_modules dist-package/
cd dist-package
zip -r ../lambda-deployment.zip . > /dev/null
cd ..
cd ..
echo -e "${GREEN}✅ Backend built and packaged${NC}"
echo ""

# Create Lambda placeholder for Terraform
echo "📦 Creating Lambda placeholder..."
cd terraform
echo '{"dummy": "placeholder"}' > placeholder.json
zip lambda-placeholder.zip placeholder.json > /dev/null
rm placeholder.json
cd ..
echo -e "${GREEN}✅ Lambda placeholder created${NC}"
echo ""

# Deploy infrastructure
echo "🏗️  Deploying infrastructure with Terraform..."
cd terraform

terraform init

echo ""
echo -e "${YELLOW}⚠️  About to deploy infrastructure. This will create AWS resources.${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Deployment cancelled."
    exit 1
fi

terraform apply -auto-approve

# Get outputs
API_URL=$(terraform output -raw api_gateway_url)
FRONTEND_BUCKET=$(terraform output -raw frontend_bucket_name)
FRONTEND_URL=$(terraform output -raw frontend_website_url)

echo -e "${GREEN}✅ Infrastructure deployed${NC}"
echo ""
echo "📝 Outputs:"
echo "  API Gateway URL: $API_URL"
echo "  Frontend Bucket: $FRONTEND_BUCKET"
echo "  Frontend URL: http://$FRONTEND_URL"
echo ""

cd ..

# Update Lambda functions
echo "🔄 Updating Lambda function code..."

FUNCTIONS=(
  "satellite-platform-request-upload-url-demo"
  "satellite-platform-confirm-upload-demo"
  "satellite-platform-search-images-demo"
  "satellite-platform-get-image-demo"
  "satellite-platform-update-image-demo"
  "satellite-platform-delete-image-demo"
  "satellite-platform-get-statistics-demo"
)

for func in "${FUNCTIONS[@]}"; do
  echo "  Updating $func..."
  aws lambda update-function-code \
    --function-name $func \
    --zip-file fileb://backend/lambda-deployment.zip \
    --region us-east-1 > /dev/null
done

echo -e "${GREEN}✅ Lambda functions updated${NC}"
echo ""

# Build frontend
echo "🔨 Building frontend..."
cd frontend

# Create .env
cat > .env << EOF
VITE_API_URL=$API_URL
VITE_AWS_REGION=us-east-1
EOF

npm run build

echo -e "${GREEN}✅ Frontend built${NC}"
echo ""

# Deploy frontend
echo "📤 Deploying frontend to S3..."
aws s3 sync dist/ s3://$FRONTEND_BUCKET/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html" > /dev/null

aws s3 cp dist/index.html s3://$FRONTEND_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate" > /dev/null

cd ..

echo -e "${GREEN}✅ Frontend deployed${NC}"
echo ""

# Success message
echo "🎉 Deployment complete!"
echo ""
echo "📱 Your application is ready:"
echo "  🌐 Frontend: http://$FRONTEND_URL"
echo "  🔗 API: $API_URL"
echo ""
echo "Next steps:"
echo "  1. Open the frontend URL in your browser"
echo "  2. Try uploading a satellite image"
echo "  3. Explore the features!"
echo ""
echo "To destroy all resources: cd terraform && terraform destroy"
echo ""
