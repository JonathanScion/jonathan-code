# Deployment script for Scheduling feature
# This script deploys Lambda functions, API Gateway routes, and frontend for the scheduling system

$ErrorActionPreference = "Stop"

Write-Host "=== Deploying Scheduling Feature ===" -ForegroundColor Cyan

# Configuration
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::276983626459:role/satellite-platform-lambda-execution-demo"
$LAMBDA_BUCKET = "satellite-platform-images-demo"
$LAMBDA_KEY = "lambda/lambda-deployment.zip"
$API_ID = "w38o94xq85"
$API_STAGE = "demo"

Write-Host "`n[1/4] Creating Lambda Functions for Requests API..." -ForegroundColor Yellow

# Function to create or update Lambda function
function Deploy-LambdaFunction {
    param (
        [string]$FunctionName,
        [string]$Handler,
        [int]$Timeout = 30,
        [int]$Memory = 256
    )

    Write-Host "  - Deploying $FunctionName..." -ForegroundColor Gray

    # Check if function exists
    $exists = $false
    try {
        aws lambda get-function --function-name $FunctionName --region $REGION 2>$null
        $exists = $true
    } catch {}

    if ($exists) {
        # Update existing function
        aws lambda update-function-code `
            --function-name $FunctionName `
            --s3-bucket $LAMBDA_BUCKET `
            --s3-key $LAMBDA_KEY `
            --region $REGION `
            --no-cli-pager | Out-Null
    } else {
        # Create new function
        aws lambda create-function `
            --function-name $FunctionName `
            --runtime nodejs20.x `
            --role $ROLE_ARN `
            --handler $Handler `
            --timeout $Timeout `
            --memory-size $Memory `
            --environment "Variables={IMAGES_TABLE=satellite-platform-images-demo,COLLECTIONS_TABLE=satellite-platform-collections-demo,REQUESTS_TABLE=satellite-platform-requests-demo}" `
            --code "S3Bucket=$LAMBDA_BUCKET,S3Key=$LAMBDA_KEY" `
            --region $REGION `
            --no-cli-pager | Out-Null
    }

    Write-Host "    ✓ $FunctionName deployed" -ForegroundColor Green
}

# Deploy all request Lambda functions
Deploy-LambdaFunction -FunctionName "satellite-platform-create-request-demo" -Handler "dist/handlers/requests.createRequest"
Deploy-LambdaFunction -FunctionName "satellite-platform-list-requests-demo" -Handler "dist/handlers/requests.listRequests"
Deploy-LambdaFunction -FunctionName "satellite-platform-get-request-demo" -Handler "dist/handlers/requests.getRequest" -Timeout 10
Deploy-LambdaFunction -FunctionName "satellite-platform-update-request-demo" -Handler "dist/handlers/requests.updateRequest" -Timeout 10
Deploy-LambdaFunction -FunctionName "satellite-platform-delete-request-demo" -Handler "dist/handlers/requests.deleteRequest" -Timeout 10
Deploy-LambdaFunction -FunctionName "satellite-platform-cancel-request-demo" -Handler "dist/handlers/requests.cancelRequest" -Timeout 10

Write-Host "`n[2/4] Setting up API Gateway Routes..." -ForegroundColor Yellow

# Get the /requests resource or create it
Write-Host "  - Finding or creating /requests resource..." -ForegroundColor Gray
$resources = aws apigateway get-resources --rest-api-id $API_ID --region $REGION | ConvertFrom-Json
$rootResource = $resources.items | Where-Object { $_.path -eq "/" }
$requestsResource = $resources.items | Where-Object { $_.path -eq "/requests" }

if (-not $requestsResource) {
    Write-Host "    Creating /requests resource..." -ForegroundColor Gray
    $requestsResource = aws apigateway create-resource `
        --rest-api-id $API_ID `
        --parent-id $rootResource.id `
        --path-part "requests" `
        --region $REGION | ConvertFrom-Json
    Write-Host "    ✓ Created /requests resource" -ForegroundColor Green
} else {
    Write-Host "    ✓ /requests resource exists" -ForegroundColor Green
}

# Create /requests/{id} resource
$requestIdResource = $resources.items | Where-Object { $_.path -eq "/requests/{id}" }
if (-not $requestIdResource) {
    Write-Host "    Creating /requests/{id} resource..." -ForegroundColor Gray
    $requestIdResource = aws apigateway create-resource `
        --rest-api-id $API_ID `
        --parent-id $requestsResource.id `
        --path-part "{id}" `
        --region $REGION | ConvertFrom-Json
    Write-Host "    ✓ Created /requests/{id} resource" -ForegroundColor Green
} else {
    Write-Host "    ✓ /requests/{id} resource exists" -ForegroundColor Green
}

# Create /requests/{id}/cancel resource
$cancelResource = $resources.items | Where-Object { $_.path -eq "/requests/{id}/cancel" }
if (-not $cancelResource) {
    Write-Host "    Creating /requests/{id}/cancel resource..." -ForegroundColor Gray
    $cancelResource = aws apigateway create-resource `
        --rest-api-id $API_ID `
        --parent-id $requestIdResource.id `
        --path-part "cancel" `
        --region $REGION | ConvertFrom-Json
    Write-Host "    ✓ Created /requests/{id}/cancel resource" -ForegroundColor Green
} else {
    Write-Host "    ✓ /requests/{id}/cancel resource exists" -ForegroundColor Green
}

# Function to setup API method
function Setup-ApiMethod {
    param (
        [string]$ResourceId,
        [string]$HttpMethod,
        [string]$FunctionName,
        [string]$Description
    )

    Write-Host "  - Setting up $HttpMethod method: $Description..." -ForegroundColor Gray

    # Create method
    try {
        aws apigateway put-method `
            --rest-api-id $API_ID `
            --resource-id $ResourceId `
            --http-method $HttpMethod `
            --authorization-type NONE `
            --region $REGION `
            --no-cli-pager 2>$null | Out-Null
    } catch {}

    # Create integration
    $functionArn = "arn:aws:lambda:${REGION}:276983626459:function:${FunctionName}"
    $integrationUri = "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${functionArn}/invocations"

    aws apigateway put-integration `
        --rest-api-id $API_ID `
        --resource-id $ResourceId `
        --http-method $HttpMethod `
        --type AWS_PROXY `
        --integration-http-method POST `
        --uri $integrationUri `
        --region $REGION `
        --no-cli-pager | Out-Null

    # Grant API Gateway permission to invoke Lambda
    try {
        aws lambda add-permission `
            --function-name $FunctionName `
            --statement-id "apigateway-${HttpMethod}-${ResourceId}" `
            --action lambda:InvokeFunction `
            --principal apigateway.amazonaws.com `
            --source-arn "arn:aws:execute-api:${REGION}:276983626459:${API_ID}/*/${HttpMethod}/requests*" `
            --region $REGION `
            --no-cli-pager 2>$null | Out-Null
    } catch {}

    Write-Host "    ✓ $Description configured" -ForegroundColor Green
}

# Setup all API methods
Setup-ApiMethod -ResourceId $requestsResource.id -HttpMethod "GET" -FunctionName "satellite-platform-list-requests-demo" -Description "GET /requests (list all)"
Setup-ApiMethod -ResourceId $requestsResource.id -HttpMethod "POST" -FunctionName "satellite-platform-create-request-demo" -Description "POST /requests (create)"
Setup-ApiMethod -ResourceId $requestIdResource.id -HttpMethod "GET" -FunctionName "satellite-platform-get-request-demo" -Description "GET /requests/{id} (get one)"
Setup-ApiMethod -ResourceId $requestIdResource.id -HttpMethod "PATCH" -FunctionName "satellite-platform-update-request-demo" -Description "PATCH /requests/{id} (update)"
Setup-ApiMethod -ResourceId $requestIdResource.id -HttpMethod "DELETE" -FunctionName "satellite-platform-delete-request-demo" -Description "DELETE /requests/{id} (delete)"
Setup-ApiMethod -ResourceId $cancelResource.id -HttpMethod "POST" -FunctionName "satellite-platform-cancel-request-demo" -Description "POST /requests/{id}/cancel (cancel)"

# Setup CORS for /requests
Write-Host "  - Setting up CORS..." -ForegroundColor Gray
foreach ($resourceId in @($requestsResource.id, $requestIdResource.id, $cancelResource.id)) {
    try {
        aws apigateway put-method `
            --rest-api-id $API_ID `
            --resource-id $resourceId `
            --http-method OPTIONS `
            --authorization-type NONE `
            --region $REGION `
            --no-cli-pager 2>$null | Out-Null

        aws apigateway put-method-response `
            --rest-api-id $API_ID `
            --resource-id $resourceId `
            --http-method OPTIONS `
            --status-code 200 `
            --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" `
            --region $REGION `
            --no-cli-pager 2>$null | Out-Null

        aws apigateway put-integration `
            --rest-api-id $API_ID `
            --resource-id $resourceId `
            --http-method OPTIONS `
            --type MOCK `
            --request-templates '{"application/json":"{\"statusCode\": 200}"}' `
            --region $REGION `
            --no-cli-pager 2>$null | Out-Null

        aws apigateway put-integration-response `
            --rest-api-id $API_ID `
            --resource-id $resourceId `
            --http-method OPTIONS `
            --status-code 200 `
            --response-parameters '{\"method.response.header.Access-Control-Allow-Headers\":\"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'\",\"method.response.header.Access-Control-Allow-Methods\":\"'"'"'GET,POST,PUT,PATCH,DELETE,OPTIONS'"'"'\",\"method.response.header.Access-Control-Allow-Origin\":\"'"'"'*'"'"'\"}' `
            --region $REGION `
            --no-cli-pager 2>$null | Out-Null
    } catch {}
}
Write-Host "    ✓ CORS configured" -ForegroundColor Green

# Deploy API
Write-Host "  - Deploying API to $API_STAGE stage..." -ForegroundColor Gray
aws apigateway create-deployment `
    --rest-api-id $API_ID `
    --stage-name $API_STAGE `
    --region $REGION `
    --no-cli-pager | Out-Null
Write-Host "    ✓ API deployed" -ForegroundColor Green

Write-Host "`n[3/4] Building Frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Write-Host "  ✓ Frontend built successfully" -ForegroundColor Green

Write-Host "`n[4/4] Deploying Frontend to S3..." -ForegroundColor Yellow
aws s3 sync dist/ s3://satellite-platform-frontend-demo --delete
Write-Host "  ✓ Frontend deployed" -ForegroundColor Green

Set-Location ..

Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Green
Write-Host "`nYour scheduling system is now live at:" -ForegroundColor Cyan
Write-Host "  Frontend: http://satellite-platform-frontend-demo.s3-website-us-east-1.amazonaws.com/scheduling" -ForegroundColor White
Write-Host "  API Base: https://$API_ID.execute-api.$REGION.amazonaws.com/$API_STAGE" -ForegroundColor White
Write-Host "`nNew Endpoints:" -ForegroundColor Cyan
Write-Host "  GET    /requests           - List all imaging requests" -ForegroundColor White
Write-Host "  POST   /requests           - Create new request" -ForegroundColor White
Write-Host "  GET    /requests/{id}      - Get specific request" -ForegroundColor White
Write-Host "  PATCH  /requests/{id}      - Update request" -ForegroundColor White
Write-Host "  DELETE /requests/{id}      - Delete request" -ForegroundColor White
Write-Host "  POST   /requests/{id}/cancel - Cancel request" -ForegroundColor White
Write-Host ""
