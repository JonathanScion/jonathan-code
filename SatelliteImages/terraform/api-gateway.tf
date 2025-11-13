# API Gateway REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "Satellite Imagery Platform API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API Gateway resources and methods
resource "aws_api_gateway_resource" "images" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "images"
}

resource "aws_api_gateway_resource" "image" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.images.id
  path_part   = "{id}"
}

resource "aws_api_gateway_resource" "images_search" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.images.id
  path_part   = "search"
}

resource "aws_api_gateway_resource" "images_upload_url" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.images.id
  path_part   = "upload-url"
}

resource "aws_api_gateway_resource" "image_confirm" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.image.id
  path_part   = "confirm"
}

resource "aws_api_gateway_resource" "analytics" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "analytics"
}

resource "aws_api_gateway_resource" "statistics" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.analytics.id
  path_part   = "statistics"
}

# POST /images/upload-url
resource "aws_api_gateway_method" "request_upload_url" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.images_upload_url.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "request_upload_url" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.images_upload_url.id
  http_method             = aws_api_gateway_method.request_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.request_upload_url.invoke_arn
}

# POST /images/{id}/confirm
resource "aws_api_gateway_method" "confirm_upload" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.image_confirm.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "confirm_upload" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.image_confirm.id
  http_method             = aws_api_gateway_method.confirm_upload.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.confirm_upload.invoke_arn
}

# POST /images/search
resource "aws_api_gateway_method" "search_images" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.images_search.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "search_images" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.images_search.id
  http_method             = aws_api_gateway_method.search_images.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.search_images.invoke_arn
}

# GET /images/{id}
resource "aws_api_gateway_method" "get_image" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.image.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_image" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.image.id
  http_method             = aws_api_gateway_method.get_image.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_image.invoke_arn
}

# PATCH /images/{id}
resource "aws_api_gateway_method" "update_image" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.image.id
  http_method   = "PATCH"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "update_image" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.image.id
  http_method             = aws_api_gateway_method.update_image.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.update_image.invoke_arn
}

# DELETE /images/{id}
resource "aws_api_gateway_method" "delete_image" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.image.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "delete_image" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.image.id
  http_method             = aws_api_gateway_method.delete_image.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.delete_image.invoke_arn
}

# GET /analytics/statistics
resource "aws_api_gateway_method" "get_statistics" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.statistics.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_statistics" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.statistics.id
  http_method             = aws_api_gateway_method.get_statistics.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_statistics.invoke_arn
}

# CORS configuration
module "cors_images" {
  source = "./modules/cors"

  api_id      = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.images.id
}

module "cors_images_upload_url" {
  source = "./modules/cors"

  api_id      = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.images_upload_url.id
}

module "cors_images_search" {
  source = "./modules/cors"

  api_id      = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.images_search.id
}

module "cors_image" {
  source = "./modules/cors"

  api_id      = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.image.id
}

module "cors_image_confirm" {
  source = "./modules/cors"

  api_id      = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.image_confirm.id
}

module "cors_statistics" {
  source = "./modules/cors"

  api_id      = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.statistics.id
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_rest_api.main.body,
      aws_api_gateway_resource.images.id,
      aws_api_gateway_resource.image.id,
      aws_api_gateway_method.request_upload_url.id,
      aws_api_gateway_method.confirm_upload.id,
      aws_api_gateway_method.search_images.id,
      aws_api_gateway_method.get_image.id,
      aws_api_gateway_method.update_image.id,
      aws_api_gateway_method.delete_image.id,
      aws_api_gateway_method.get_statistics.id,
      aws_api_gateway_integration.request_upload_url.id,
      aws_api_gateway_integration.confirm_upload.id,
      aws_api_gateway_integration.search_images.id,
      aws_api_gateway_integration.get_image.id,
      aws_api_gateway_integration.update_image.id,
      aws_api_gateway_integration.delete_image.id,
      aws_api_gateway_integration.get_statistics.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.request_upload_url,
    aws_api_gateway_integration.confirm_upload,
    aws_api_gateway_integration.search_images,
    aws_api_gateway_integration.get_image,
    aws_api_gateway_integration.update_image,
    aws_api_gateway_integration.delete_image,
    aws_api_gateway_integration.get_statistics,
  ]
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  for_each = {
    request_upload_url = aws_lambda_function.request_upload_url.function_name
    confirm_upload     = aws_lambda_function.confirm_upload.function_name
    search_images      = aws_lambda_function.search_images.function_name
    get_image          = aws_lambda_function.get_image.function_name
    update_image       = aws_lambda_function.update_image.function_name
    delete_image       = aws_lambda_function.delete_image.function_name
    get_statistics     = aws_lambda_function.get_statistics.function_name
  }

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}
