# EOI Space Satellite Platform - Deployment Script (PowerShell)
# This script automates the deployment process for Windows

$ErrorActionPreference = "Stop"

Write-Host "EOI Space Satellite Platform - Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

try {
    node --version | Out-Null
    npm --version | Out-Null
    aws --version | Out-Null
    terraform --version | Out-Null
} catch {
    Write-Host "Missing required tools. Please install:" -ForegroundColor Red
    Write-Host "  - Node.js" -ForegroundColor Red
    Write-Host "  - AWS CLI" -ForegroundColor Red
    Write-Host "  - Terraform" -ForegroundColor Red
    exit 1
}

Write-Host "All prerequisites met" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Set-Location shared
npm install
Set-Location ..

Set-Location backend
npm install
Set-Location ..

Set-Location frontend
npm install
Set-Location ..

Write-Host "Dependencies installed" -ForegroundColor Green
Write-Host ""

# Build shared types
Write-Host "Building shared types..." -ForegroundColor Yellow
Set-Location shared
npm run build
Set-Location ..
Write-Host "Shared types built" -ForegroundColor Green
Write-Host ""

# Build backend
Write-Host "Building backend..." -ForegroundColor Yellow
Set-Location backend
npm run build

# Package Lambda
Write-Host "Packaging Lambda functions..." -ForegroundColor Yellow
if (Test-Path dist-package) { Remove-Item -Recurse -Force dist-package }
if (Test-Path lambda-deployment.zip) { Remove-Item -Force lambda-deployment.zip }

New-Item -ItemType Directory -Force -Path dist-package | Out-Null
Copy-Item -Recurse dist dist-package/
Copy-Item -Recurse node_modules dist-package/

Compress-Archive -Path dist-package\* -DestinationPath lambda-deployment.zip -Force

Set-Location ..
Write-Host "Backend built and packaged" -ForegroundColor Green
Write-Host ""

# Create Lambda placeholder
Write-Host "Creating Lambda placeholder..." -ForegroundColor Yellow
Set-Location terraform
'{"dummy": "placeholder"}' | Out-File -FilePath placeholder.json -Encoding ASCII
Compress-Archive -Path placeholder.json -DestinationPath lambda-placeholder.zip -Force
Remove-Item placeholder.json
Set-Location ..
Write-Host "Lambda placeholder created" -ForegroundColor Green
Write-Host ""

# Deploy infrastructure
Write-Host "Deploying infrastructure with Terraform..." -ForegroundColor Yellow
Set-Location terraform

terraform init

Write-Host ""
Write-Host "About to deploy infrastructure. This will create AWS resources." -ForegroundColor Yellow
$continue = Read-Host "Continue? (y/n)"
if ($continue -ne "y") {
    Write-Host "Deployment cancelled." -ForegroundColor Red
    exit 1
}

terraform apply -auto-approve

# Get outputs
$API_URL = terraform output -raw api_gateway_url
$FRONTEND_BUCKET = terraform output -raw frontend_bucket_name
$FRONTEND_URL = terraform output -raw frontend_website_url

Write-Host "Infrastructure deployed" -ForegroundColor Green
Write-Host ""
Write-Host "Outputs:" -ForegroundColor Cyan
Write-Host "  API Gateway URL: $API_URL"
Write-Host "  Frontend Bucket: $FRONTEND_BUCKET"
Write-Host "  Frontend URL: http://$FRONTEND_URL"
Write-Host ""

Set-Location ..

# Update Lambda functions
Write-Host "Updating Lambda function code..." -ForegroundColor Yellow

$FUNCTIONS = @(
    "satellite-platform-request-upload-url-demo",
    "satellite-platform-confirm-upload-demo",
    "satellite-platform-search-images-demo",
    "satellite-platform-get-image-demo",
    "satellite-platform-update-image-demo",
    "satellite-platform-delete-image-demo",
    "satellite-platform-get-statistics-demo"
)

foreach ($func in $FUNCTIONS) {
    Write-Host "  Updating $func..."
    aws lambda update-function-code `
        --function-name $func `
        --zip-file fileb://backend/lambda-deployment.zip `
        --region us-east-1 | Out-Null
}

Write-Host "Lambda functions updated" -ForegroundColor Green
Write-Host ""

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location frontend

# Create .env
@"
VITE_API_URL=$API_URL
VITE_AWS_REGION=us-east-1
"@ | Out-File -FilePath .env -Encoding ASCII

npm run build

Write-Host "Frontend built" -ForegroundColor Green
Write-Host ""

# Deploy frontend
Write-Host "Deploying frontend to S3..." -ForegroundColor Yellow
aws s3 sync dist/ s3://$FRONTEND_BUCKET/ `
    --delete `
    --cache-control "public, max-age=31536000" `
    --exclude "index.html" | Out-Null

aws s3 cp dist/index.html s3://$FRONTEND_BUCKET/index.html `
    --cache-control "no-cache, no-store, must-revalidate" | Out-Null

Set-Location ..

Write-Host "Frontend deployed" -ForegroundColor Green
Write-Host ""

# Success message
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your application is ready:" -ForegroundColor Cyan
Write-Host "  Frontend: http://$FRONTEND_URL"
Write-Host "  API: $API_URL"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open the frontend URL in your browser"
Write-Host "  2. Try uploading a satellite image"
Write-Host "  3. Explore the features!"
Write-Host ""
Write-Host "To destroy all resources: cd terraform and run terraform destroy" -ForegroundColor Yellow
Write-Host ""

#final URL: http://satellite-platform-frontend-demo.s3-website-us-east-1.amazonaws.com/