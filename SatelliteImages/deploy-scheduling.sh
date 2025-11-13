#!/bin/bash
# Deployment script for Scheduling feature
# This script deploys Lambda functions, API Gateway routes, and frontend for the scheduling system

set -e

echo "=== Deploying Scheduling Feature ==="

# Configuration
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::276983626459:role/satellite-platform-lambda-execution-demo"
LAMBDA_BUCKET="satellite-platform-images-demo"
LAMBDA_KEY="lambda/lambda-deployment.zip"
API_ID="w38o94xq85"
API_STAGE="demo"
ACCOUNT_ID="276983626459"

echo ""
echo "[1/4] Creating Lambda Functions for Requests API..."

# Function to create or update Lambda function
deploy_lambda_function() {
    local FUNCTION_NAME=$1
    local HANDLER=$2
    local TIMEOUT=${3:-30}
    local MEMORY=${4:-256}

    echo "  - Deploying $FUNCTION_NAME..."

    # Check if function exists
    if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &>/dev/null; then
        # Update existing function
        aws lambda update-function-code \
            --function-name $FUNCTION_NAME \
            --s3-bucket $LAMBDA_BUCKET \
            --s3-key $LAMBDA_KEY \
            --region $REGION \
            --no-cli-pager >/dev/null
    else
        # Create new function
        aws lambda create-function \
            --function-name $FUNCTION_NAME \
            --runtime nodejs20.x \
            --role $ROLE_ARN \
            --handler $HANDLER \
            --timeout $TIMEOUT \
            --memory-size $MEMORY \
            --environment "Variables={IMAGES_TABLE=satellite-platform-images-demo,COLLECTIONS_TABLE=satellite-platform-collections-demo,REQUESTS_TABLE=satellite-platform-requests-demo}" \
            --code "S3Bucket=$LAMBDA_BUCKET,S3Key=$LAMBDA_KEY" \
            --region $REGION \
            --no-cli-pager >/dev/null
    fi

    echo "    ✓ $FUNCTION_NAME deployed"
}

# Deploy all request Lambda functions
deploy_lambda_function "satellite-platform-create-request-demo" "dist/handlers/requests.createRequest"
deploy_lambda_function "satellite-platform-list-requests-demo" "dist/handlers/requests.listRequests"
deploy_lambda_function "satellite-platform-get-request-demo" "dist/handlers/requests.getRequest" 10
deploy_lambda_function "satellite-platform-update-request-demo" "dist/handlers/requests.updateRequest" 10
deploy_lambda_function "satellite-platform-delete-request-demo" "dist/handlers/requests.deleteRequest" 10
deploy_lambda_function "satellite-platform-cancel-request-demo" "dist/handlers/requests.cancelRequest" 10

echo ""
echo "[2/4] Setting up API Gateway Routes..."

# Get the /requests resource or create it
echo "  - Finding or creating /requests resource..."
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION)
ROOT_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/") | .id')
REQUESTS_RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/requests") | .id')

if [ "$REQUESTS_RESOURCE_ID" == "null" ] || [ -z "$REQUESTS_RESOURCE_ID" ]; then
    echo "    Creating /requests resource..."
    REQUESTS_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_ID \
        --path-part "requests" \
        --region $REGION | jq -r '.id')
    echo "    ✓ Created /requests resource"
else
    echo "    ✓ /requests resource exists"
fi

# Create /requests/{id} resource
REQUEST_ID_RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/requests/{id}") | .id')
if [ "$REQUEST_ID_RESOURCE_ID" == "null" ] || [ -z "$REQUEST_ID_RESOURCE_ID" ]; then
    echo "    Creating /requests/{id} resource..."
    REQUEST_ID_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $REQUESTS_RESOURCE_ID \
        --path-part "{id}" \
        --region $REGION | jq -r '.id')
    echo "    ✓ Created /requests/{id} resource"
else
    echo "    ✓ /requests/{id} resource exists"
fi

# Create /requests/{id}/cancel resource
CANCEL_RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/requests/{id}/cancel") | .id')
if [ "$CANCEL_RESOURCE_ID" == "null" ] || [ -z "$CANCEL_RESOURCE_ID" ]; then
    echo "    Creating /requests/{id}/cancel resource..."
    CANCEL_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $REQUEST_ID_RESOURCE_ID \
        --path-part "cancel" \
        --region $REGION | jq -r '.id')
    echo "    ✓ Created /requests/{id}/cancel resource"
else
    echo "    ✓ /requests/{id}/cancel resource exists"
fi

# Function to setup API method
setup_api_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local FUNCTION_NAME=$3
    local DESCRIPTION=$4

    echo "  - Setting up $HTTP_METHOD method: $DESCRIPTION..."

    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --authorization-type NONE \
        --region $REGION \
        --no-cli-pager &>/dev/null || true

    # Create integration
    FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"
    INTEGRATION_URI="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${FUNCTION_ARN}/invocations"

    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri $INTEGRATION_URI \
        --region $REGION \
        --no-cli-pager >/dev/null

    # Grant API Gateway permission to invoke Lambda
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --statement-id "apigateway-${HTTP_METHOD}-${RESOURCE_ID}" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${HTTP_METHOD}/requests*" \
        --region $REGION \
        --no-cli-pager &>/dev/null || true

    echo "    ✓ $DESCRIPTION configured"
}

# Setup all API methods
setup_api_method "$REQUESTS_RESOURCE_ID" "GET" "satellite-platform-list-requests-demo" "GET /requests (list all)"
setup_api_method "$REQUESTS_RESOURCE_ID" "POST" "satellite-platform-create-request-demo" "POST /requests (create)"
setup_api_method "$REQUEST_ID_RESOURCE_ID" "GET" "satellite-platform-get-request-demo" "GET /requests/{id} (get one)"
setup_api_method "$REQUEST_ID_RESOURCE_ID" "PATCH" "satellite-platform-update-request-demo" "PATCH /requests/{id} (update)"
setup_api_method "$REQUEST_ID_RESOURCE_ID" "DELETE" "satellite-platform-delete-request-demo" "DELETE /requests/{id} (delete)"
setup_api_method "$CANCEL_RESOURCE_ID" "POST" "satellite-platform-cancel-request-demo" "POST /requests/{id}/cancel (cancel)"

# Setup CORS for /requests
echo "  - Setting up CORS..."
for RESOURCE_ID in $REQUESTS_RESOURCE_ID $REQUEST_ID_RESOURCE_ID $CANCEL_RESOURCE_ID; do
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION \
        --no-cli-pager &>/dev/null || true

    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" \
        --region $REGION \
        --no-cli-pager &>/dev/null || true

    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
        --region $REGION \
        --no-cli-pager &>/dev/null || true

    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,PATCH,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --region $REGION \
        --no-cli-pager &>/dev/null || true
done
echo "    ✓ CORS configured"

# Deploy API
echo "  - Deploying API to $API_STAGE stage..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $API_STAGE \
    --region $REGION \
    --no-cli-pager >/dev/null
echo "    ✓ API deployed"

echo ""
echo "[3/4] Building Frontend..."
cd frontend
npm run build
echo "  ✓ Frontend built successfully"

echo ""
echo "[4/4] Deploying Frontend to S3..."
aws s3 sync dist/ s3://satellite-platform-frontend-demo --delete
echo "  ✓ Frontend deployed"

cd ..

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "Your scheduling system is now live at:"
echo "  Frontend: http://satellite-platform-frontend-demo.s3-website-us-east-1.amazonaws.com/scheduling"
echo "  API Base: https://$API_ID.execute-api.$REGION.amazonaws.com/$API_STAGE"
echo ""
echo "New Endpoints:"
echo "  GET    /requests           - List all imaging requests"
echo "  POST   /requests           - Create new request"
echo "  GET    /requests/{id}      - Get specific request"
echo "  PATCH  /requests/{id}      - Update request"
echo "  DELETE /requests/{id}      - Delete request"
echo "  POST   /requests/{id}/cancel - Cancel request"
echo ""
