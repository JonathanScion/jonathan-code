# Deployment Guide - EOI Space Satellite Platform

> **⚠️ IMPORTANT:** If you encounter CORS errors or Lambda function failures, see **[LAMBDA-DEPLOYMENT-TROUBLESHOOTING.md](./LAMBDA-DEPLOYMENT-TROUBLESHOOTING.md)** for detailed diagnostics and solutions.

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js** 18 or higher
4. **Terraform** 1.5.0 or higher
5. **Git** for version control

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd SatelliteImages
npm install
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
```

### 3. Build the Application

```bash
# Install all dependencies
npm run install:all

# Build shared types
cd shared && npm run build && cd ..

# Build backend
cd backend && npm run build && cd ..

# Build frontend (will be done later with correct API URL)
```

### 4. Package Lambda Functions

```bash
cd backend
mkdir -p dist-package
cp -r dist node_modules dist-package/
cd dist-package
# On Windows, use 7-zip or similar
# On Linux/Mac:
zip -r ../lambda-deployment.zip .
cd ../..
```

### 5. Create Lambda Placeholder

The Terraform configuration expects a `lambda-placeholder.zip` file. Create one:

```bash
cd terraform
echo '{"dummy": "placeholder"}' > placeholder.json
zip lambda-placeholder.zip placeholder.json
rm placeholder.json
```

### 6. Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy (type 'yes' when prompted)
terraform apply

# Save the outputs
terraform output
```

**Important Outputs:**
- `api_gateway_url`: Your API endpoint
- `frontend_bucket_name`: S3 bucket for frontend
- `frontend_website_url`: Your website URL
- `images_bucket_name`: S3 bucket for images

### 7. Update Lambda Functions

After Terraform creates the functions, update them with actual code:

```bash
cd ../backend

# Upload to S3 first (more reliable for large packages)
aws s3 cp lambda-deployment.zip s3://satellite-platform-images-demo/lambda-deployment.zip

# Update all Lambda functions
FUNCTIONS=(
  "satellite-platform-request-upload-url-demo"
  "satellite-platform-confirm-upload-demo"
  "satellite-platform-search-images-demo"
  "satellite-platform-get-image-demo"
  "satellite-platform-update-image-demo"
  "satellite-platform-delete-image-demo"
  "satellite-platform-get-statistics-demo"
  "satellite-platform-create-request-demo"
  "satellite-platform-list-requests-demo"
  "satellite-platform-get-request-demo"
  "satellite-platform-update-request-demo"
  "satellite-platform-delete-request-demo"
  "satellite-platform-cancel-request-demo"
  "satellite-platform-get-all-collections-demo"
)

# Update each function
for func in "${FUNCTIONS[@]}"; do
  echo "Updating $func..."
  aws lambda update-function-code \
    --function-name $func \
    --s3-bucket satellite-platform-images-demo \
    --s3-key lambda-deployment.zip \
    --region us-east-1
done

# Wait for updates to complete
sleep 10

# CRITICAL: Verify handler paths are correct
echo "Verifying handler paths..."
for func in "${FUNCTIONS[@]}"; do
  handler=$(aws lambda get-function-configuration --function-name $func --query 'Handler' --output text)
  size=$(aws lambda get-function-configuration --function-name $func --query 'CodeSize' --output text)

  # Handler should start with "backend/src/handlers/"
  # Size should be ~28MB (28000000 bytes)
  if [[ ! "$handler" =~ ^backend/src/handlers/ ]]; then
    echo "⚠️  WARNING: $func has incorrect handler: $handler"
    echo "   Should be: backend/src/handlers/[module].[function]"
  fi

  if [[ "$size" -lt 25000000 ]]; then
    echo "⚠️  WARNING: $func has small code size: $size bytes (expected ~28MB)"
  fi
done

echo "✓ Lambda deployment complete"
```

**Handler Path Format:** All handlers must follow: `backend/src/handlers/[module].[functionName]`

Examples:
- `backend/src/handlers/requests.listRequests`
- `backend/src/handlers/images.searchImages`
- `backend/src/handlers/upload.requestUploadUrl`

### 8. Build and Deploy Frontend

```bash
cd ../frontend

# Create .env file with API URL from Terraform output
echo "VITE_API_URL=<your-api-gateway-url>" > .env
echo "VITE_AWS_REGION=us-east-1" >> .env

# Build frontend
npm run build

# Deploy to S3
aws s3 sync dist/ s3://<your-frontend-bucket-name>/ --delete
```

### 9. Access Your Application

Open the frontend URL from Terraform output:
```
http://<frontend-bucket-name>.s3-website-us-east-1.amazonaws.com
```

---

## GitHub Actions Deployment

### Setup

1. **Fork/Clone the repository** to your GitHub account

2. **Configure GitHub Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `AWS_ACCESS_KEY_ID`: Your AWS access key
     - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
     - `API_GATEWAY_URL`: (after first manual deploy)

3. **Push to main branch**:
```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

4. **Monitor deployment**:
   - Go to Actions tab in GitHub
   - Watch the deployment workflow
   - Check for any errors

### Continuous Deployment

After initial setup, any push to `main` branch will:
1. Build all components
2. Run tests and linting
3. Deploy infrastructure updates
4. Update Lambda functions
5. Deploy frontend to S3

---

## Manual Deployment (Detailed)

### Step 1: Prepare the Environment

```bash
# Set environment variables
export AWS_REGION=us-east-1
export PROJECT_NAME=satellite-platform
export ENVIRONMENT=demo
```

### Step 2: Build Shared Types

```bash
cd shared
npm install
npm run build
```

### Step 3: Build Backend

```bash
cd ../backend
npm install

# IMPORTANT: Build with tsc-alias to resolve path aliases
npm run build  # Runs: tsc && tsc-alias

# Verify no unresolved TypeScript path aliases
grep -r "@shared" dist/backend/src/handlers/ || echo "✓ Path aliases resolved correctly"

# Package for Lambda - CORRECT STRUCTURE
rm -rf dist-package lambda-deployment.zip
mkdir dist-package

# Copy compiled code (already in backend/ and shared/ folders)
cp -r dist/backend dist-package/
cp -r dist/shared dist-package/

# Copy node_modules (use working Lambda or fresh install)
# Option A: From existing working Lambda (faster)
aws lambda get-function --function-name satellite-platform-create-request-demo \
  --query 'Code.Location' --output text | xargs curl -o working-lambda.zip
unzip -q working-lambda.zip -d working-lambda
cp -r working-lambda/node_modules dist-package/

# Option B: Fresh install (if Option A unavailable)
# npm install --omit=dev
# cp -r node_modules dist-package/

# Verify package size (should be ~150MB)
du -sh dist-package  # Expected: 150M-200M

# Create zip
cd dist-package
zip -r ../lambda-deployment.zip .
cd ..

# Verify zip size (should be ~28MB)
ls -lh lambda-deployment.zip  # Expected: 27M-30M
```

**⚠️ TROUBLESHOOTING:** If Lambda functions fail with CORS errors, see [LAMBDA-DEPLOYMENT-TROUBLESHOOTING.md](./LAMBDA-DEPLOYMENT-TROUBLESHOOTING.md) for detailed diagnostics.

### Step 4: Initialize Terraform

```bash
cd ../terraform

# Initialize
terraform init

# Create workspace (optional)
terraform workspace new demo
terraform workspace select demo
```

### Step 5: Configure Terraform Variables

Create `terraform.tfvars`:
```hcl
aws_region   = "us-east-1"
environment  = "demo"
project_name = "satellite-platform"
```

### Step 6: Deploy Infrastructure

```bash
# Plan deployment
terraform plan -out=tfplan

# Apply deployment
terraform apply tfplan

# Get outputs
terraform output -json > outputs.json
```

### Step 7: Update Lambda Code

```bash
# Extract function names from Terraform state
FUNCTIONS=$(terraform state list | grep aws_lambda_function | grep -v data)

# Update each function
for func in $FUNCTIONS; do
  FUNC_NAME=$(terraform state show $func | grep function_name | awk '{print $3}' | tr -d '"')
  echo "Updating $FUNC_NAME..."

  aws lambda update-function-code \
    --function-name $FUNC_NAME \
    --zip-file fileb://../backend/lambda-deployment.zip \
    --region $AWS_REGION
done
```

### Step 8: Build Frontend

```bash
cd ../frontend

# Get API URL from Terraform
API_URL=$(cd ../terraform && terraform output -raw api_gateway_url)

# Create .env
cat > .env << EOF
VITE_API_URL=$API_URL
VITE_AWS_REGION=$AWS_REGION
EOF

# Install and build
npm install
npm run build
```

### Step 9: Deploy Frontend

```bash
# Get bucket name
BUCKET=$(cd ../terraform && terraform output -raw frontend_bucket_name)

# Sync to S3
aws s3 sync dist/ s3://$BUCKET/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html"

# Upload index.html separately with no-cache
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"
```

---

## Updating the Application

### Update Backend Code

```bash
cd backend
npm run build

# Re-package
cd dist-package
zip -r ../lambda-deployment.zip .
cd ..

# Update Lambda functions (use script from Step 7)
```

### Update Frontend Code

```bash
cd frontend
npm run build

# Get bucket name
BUCKET=$(cd ../terraform && terraform output -raw frontend_bucket_name)

# Deploy
aws s3 sync dist/ s3://$BUCKET/ --delete
```

### Update Infrastructure

```bash
cd terraform
terraform plan
terraform apply
```

---

## Destroying the Infrastructure

**WARNING: This will delete all data!**

```bash
cd terraform

# Destroy all resources
terraform destroy

# Type 'yes' when prompted
```

---

## Troubleshooting

### Lambda Functions Not Working

**Issue**: Functions return 5xx errors

**Solution**:
```bash
# Check logs
aws logs tail /aws/lambda/satellite-platform-search-images-demo --follow

# Verify function code is updated
aws lambda get-function --function-name satellite-platform-search-images-demo
```

### Frontend Not Loading

**Issue**: Blank page or 404 errors

**Solution**:
```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket <bucket-name>

# Verify files uploaded
aws s3 ls s3://<bucket-name>/

# Check website configuration
aws s3api get-bucket-website --bucket <bucket-name>
```

### CORS Errors

**Issue**: Browser console shows CORS errors

**Solution**:
```bash
# Check API Gateway CORS settings
# Update terraform/api-gateway.tf to include CORS module
terraform apply
```

### DynamoDB Access Errors

**Issue**: Lambda can't read/write to DynamoDB

**Solution**:
- Verify IAM role permissions in `terraform/lambda.tf`
- Check table names in Lambda environment variables
- Verify tables exist: `aws dynamodb list-tables`

---

## Production Considerations

### 1. Custom Domain

Add CloudFront distribution:

```hcl
# In terraform/cloudfront.tf
resource "aws_cloudfront_distribution" "main" {
  # ... configuration
}
```

### 2. SSL Certificate

```bash
# Request certificate in ACM
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS
```

### 3. Environment Variables

Create separate `.tfvars` files:
- `dev.tfvars`
- `staging.tfvars`
- `production.tfvars`

### 4. State Management

Configure S3 backend in `terraform/main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "satellite-platform/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
```

### 5. Monitoring

Set up CloudWatch alarms:
- Lambda errors
- API Gateway 5xx errors
- DynamoDB throttling
- S3 bucket size

### 6. Backup

Enable:
- DynamoDB point-in-time recovery
- S3 versioning (already enabled)
- Regular snapshots

---

## Cost Estimation

**Demo Usage (100 images, 100 requests/day):**
- S3: ~$1/month
- DynamoDB: ~$1/month (on-demand)
- Lambda: <$1/month (free tier)
- API Gateway: <$1/month (free tier)
- **Total: ~$3-5/month**

**Production Usage (10,000 images, 10,000 requests/day):**
- S3: ~$50/month
- DynamoDB: ~$10/month
- Lambda: ~$20/month
- API Gateway: ~$30/month
- CloudFront: ~$50/month
- **Total: ~$160/month**

---

## Support

For issues:
1. Check CloudWatch Logs
2. Review Terraform state
3. Verify AWS permissions
4. Check GitHub Actions logs (if using CI/CD)

For questions about EOI Space: https://eoi.space
