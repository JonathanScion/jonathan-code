# IAM role for Lambda functions
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-lambda-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda functions
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.images.arn,
          "${aws_dynamodb_table.images.arn}/index/*",
          aws_dynamodb_table.collections.arn,
          "${aws_dynamodb_table.collections.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.images.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.images.arn
      }
    ]
  })
}

# Lambda functions (placeholders - in production, use actual deployment packages)
resource "aws_lambda_function" "request_upload_url" {
  filename      = "lambda-placeholder.zip" # You'll need to build this
  function_name = "${var.project_name}-request-upload-url-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "dist/handlers/upload.requestUploadUrl"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      IMAGES_TABLE      = aws_dynamodb_table.images.name
      COLLECTIONS_TABLE = aws_dynamodb_table.collections.name
      IMAGES_BUCKET     = aws_s3_bucket.images.bucket
    }
  }
}

resource "aws_lambda_function" "confirm_upload" {
  filename      = "lambda-placeholder.zip"
  function_name = "${var.project_name}-confirm-upload-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "dist/handlers/upload.confirmUpload"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 512

  environment {
    variables = {
      IMAGES_TABLE      = aws_dynamodb_table.images.name
      COLLECTIONS_TABLE = aws_dynamodb_table.collections.name
      IMAGES_BUCKET     = aws_s3_bucket.images.bucket
    }
  }
}

resource "aws_lambda_function" "search_images" {
  filename      = "lambda-placeholder.zip"
  function_name = "${var.project_name}-search-images-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "dist/handlers/images.searchImages"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      IMAGES_TABLE      = aws_dynamodb_table.images.name
      COLLECTIONS_TABLE = aws_dynamodb_table.collections.name
      IMAGES_BUCKET     = aws_s3_bucket.images.bucket
    }
  }
}

resource "aws_lambda_function" "get_image" {
  filename      = "lambda-placeholder.zip"
  function_name = "${var.project_name}-get-image-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "dist/handlers/images.getImage"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  environment {
    variables = {
      IMAGES_TABLE      = aws_dynamodb_table.images.name
      COLLECTIONS_TABLE = aws_dynamodb_table.collections.name
      IMAGES_BUCKET     = aws_s3_bucket.images.bucket
    }
  }
}

resource "aws_lambda_function" "update_image" {
  filename      = "lambda-placeholder.zip"
  function_name = "${var.project_name}-update-image-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "dist/handlers/images.updateImage"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  environment {
    variables = {
      IMAGES_TABLE      = aws_dynamodb_table.images.name
      COLLECTIONS_TABLE = aws_dynamodb_table.collections.name
      IMAGES_BUCKET     = aws_s3_bucket.images.bucket
    }
  }
}

resource "aws_lambda_function" "delete_image" {
  filename      = "lambda-placeholder.zip"
  function_name = "${var.project_name}-delete-image-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "dist/handlers/images.deleteImage"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      IMAGES_TABLE      = aws_dynamodb_table.images.name
      COLLECTIONS_TABLE = aws_dynamodb_table.collections.name
      IMAGES_BUCKET     = aws_s3_bucket.images.bucket
    }
  }
}

resource "aws_lambda_function" "get_statistics" {
  filename      = "lambda-placeholder.zip"
  function_name = "${var.project_name}-get-statistics-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "dist/handlers/analytics.getStatistics"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      IMAGES_TABLE      = aws_dynamodb_table.images.name
      COLLECTIONS_TABLE = aws_dynamodb_table.collections.name
      IMAGES_BUCKET     = aws_s3_bucket.images.bucket
    }
  }
}
