# DynamoDB table for satellite images metadata
resource "aws_dynamodb_table" "images" {
  name           = "${var.project_name}-images-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "uploadedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "userId"
    range_key       = "uploadedAt"
    projection_type = "ALL"
  }

  tags = {
    Name = "Satellite Images Table"
  }
}

# DynamoDB table for collections
resource "aws_dynamodb_table" "collections" {
  name           = "${var.project_name}-collections-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  tags = {
    Name = "Collections Table"
  }
}
