output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "frontend_bucket_name" {
  description = "Frontend S3 bucket name"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_website_url" {
  description = "Frontend website URL"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

output "images_bucket_name" {
  description = "Images S3 bucket name"
  value       = aws_s3_bucket.images.bucket
}

output "dynamodb_images_table" {
  description = "DynamoDB images table name"
  value       = aws_dynamodb_table.images.name
}

output "dynamodb_collections_table" {
  description = "DynamoDB collections table name"
  value       = aws_dynamodb_table.collections.name
}
