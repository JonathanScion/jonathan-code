# Terraform Infrastructure

This directory contains the Terraform configuration for deploying the Satellite Imagery Platform to AWS.

## Architecture

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│  S3 Bucket  │◄─────┤   Frontend   │
│  (Website)  │      │    (React)   │
└─────────────┘      └──────────────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│ API Gateway │◄────►│    Lambda    │
└──────┬──────┘      │  Functions   │
       │             └──────┬───────┘
       ▼                    │
┌─────────────┐            ▼
│  DynamoDB   │      ┌──────────────┐
│   Tables    │      │  S3 Bucket   │
│             │      │   (Images)   │
└─────────────┘      └──────────────┘
```

## Resources Created

### Storage
- **S3 Bucket (Images)**: Stores satellite imagery files
  - Versioning enabled
  - Server-side encryption
  - CORS configured
  - Public access blocked

- **S3 Bucket (Frontend)**: Static website hosting
  - Public read access
  - Website configuration
  - Error document for React Router

### Database
- **DynamoDB Table (Images)**: Image metadata
  - On-demand billing
  - Global secondary index on userId
  - Point-in-time recovery (optional)

- **DynamoDB Table (Collections)**: User collections
  - On-demand billing
  - Global secondary index on userId

### Compute
- **Lambda Functions** (7 total):
  - Request upload URL
  - Confirm upload
  - Search images
  - Get image
  - Update image
  - Delete image
  - Get statistics

- **IAM Role**: Lambda execution role with permissions for:
  - CloudWatch Logs
  - DynamoDB access
  - S3 access

### API
- **API Gateway REST API**: HTTP endpoints
  - Regional endpoint
  - CORS enabled
  - Lambda integrations

- **API Gateway Stage**: Deployment stage
  - Named after environment variable
  - Logging enabled

## File Structure

```
terraform/
├── main.tf              # Provider configuration
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── s3.tf               # S3 bucket configurations
├── dynamodb.tf         # DynamoDB tables
├── lambda.tf           # Lambda functions and IAM
├── api-gateway.tf      # API Gateway configuration
├── modules/
│   └── cors/           # CORS configuration module
│       └── main.tf
└── README.md           # This file
```

## Variables

| Name | Description | Default |
|------|-------------|---------|
| `aws_region` | AWS region | `us-east-1` |
| `environment` | Environment name | `demo` |
| `project_name` | Project name prefix | `satellite-platform` |

## Outputs

| Name | Description |
|------|-------------|
| `api_gateway_url` | API Gateway endpoint URL |
| `frontend_bucket_name` | Frontend S3 bucket name |
| `frontend_website_url` | Frontend website URL |
| `images_bucket_name` | Images S3 bucket name |
| `dynamodb_images_table` | Images DynamoDB table name |
| `dynamodb_collections_table` | Collections DynamoDB table name |

## Usage

### Initialize

```bash
terraform init
```

### Plan

```bash
terraform plan -out=tfplan
```

### Apply

```bash
terraform apply tfplan
```

### Destroy

```bash
terraform destroy
```

## Customization

### Change Region

```bash
terraform apply -var="aws_region=eu-west-1"
```

### Change Environment

```bash
terraform apply -var="environment=production"
```

### Use Variables File

Create `terraform.tfvars`:
```hcl
aws_region   = "us-east-1"
environment  = "production"
project_name = "my-satellite-platform"
```

Then apply:
```bash
terraform apply
```

## State Management

### Local State (Default)
State is stored in `terraform.tfstate` (gitignored).

### Remote State (Production)
Uncomment the backend configuration in `main.tf`:

```hcl
backend "s3" {
  bucket = "your-terraform-state-bucket"
  key    = "satellite-platform/terraform.tfstate"
  region = "us-east-1"
}
```

Create the state bucket first:
```bash
aws s3 mb s3://your-terraform-state-bucket
```

## Notes

### Lambda Placeholder
The Lambda functions use a placeholder zip file initially. After Terraform creates the functions, update them with:

```bash
aws lambda update-function-code \
  --function-name <function-name> \
  --zip-file fileb://path/to/lambda-deployment.zip
```

### CORS Module
The CORS module adds OPTIONS method to API Gateway resources for browser compatibility.

### Naming Convention
All resources are named with pattern: `{project_name}-{resource}-{environment}`

Example: `satellite-platform-images-demo`

## Cost Optimization

- DynamoDB uses on-demand billing (pay per request)
- Lambda free tier covers 1M requests/month
- S3 Standard storage is used (consider Glacier for archives)
- No NAT Gateway or other costly resources

## Security

- S3 buckets have encryption enabled
- IAM roles follow least privilege principle
- Public access blocked on images bucket
- HTTPS enforced on API Gateway

## Monitoring

Add CloudWatch alarms (optional):

```hcl
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors lambda errors"
}
```

## Troubleshooting

### Error: Bucket already exists
S3 bucket names must be globally unique. Change `project_name` variable.

### Error: Lambda function not found
Ensure Lambda deployment package exists: `lambda-placeholder.zip`

### Error: DynamoDB throughput exceeded
Switch to provisioned billing or increase on-demand limits.

### Error: API Gateway 502
Check Lambda function logs in CloudWatch.
