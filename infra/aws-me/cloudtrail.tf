# ─────────────────────────────────────────────────────────────────────────────
# CloudTrail — multi-region trail with S3 + CloudWatch Logs destinations.
#
# AWS accounts ship with a default "management events" trail that covers
# control-plane API calls, but:
#   - It's a single region by default
#   - Retention is 90 days in the console, no S3 archive
#   - ME compliance (SOC 2, NDMO, NESA) expects explicit multi-region trail
#     with ≥1y S3 retention and tamper-proof logs (S3 Object Lock)
#
# This resource creates that explicit trail. Data events (S3 object reads,
# Lambda invokes) are NOT logged by default — they're high-volume and
# expensive. Add only when compliance or a specific audit demands it.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "cloudtrail" {
  bucket        = "${local.name_prefix}-cloudtrail"
  force_destroy = var.environment != "production"
}

resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  bucket                  = aws_s3_bucket.cloudtrail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    # Transition to Glacier after 90d, expire after 7y (compliance retention).
    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555  # ~7 years
    }
  }
}

# Bucket policy — CloudTrail needs s3:PutObject with a specific condition.
resource "aws_s3_bucket_policy" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.cloudtrail.arn
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.cloudtrail.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/aws/cloudtrail/${local.name_prefix}"
  retention_in_days = 365  # keep 1y hot in CloudWatch; older is in S3/Glacier
}

resource "aws_iam_role" "cloudtrail_logs" {
  name = "${local.name_prefix}-cloudtrail-logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudtrail.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "cloudtrail_logs" {
  name = "${local.name_prefix}-cloudtrail-logs"
  role = aws_iam_role.cloudtrail_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
    }]
  })
}

resource "aws_cloudtrail" "this" {
  name                          = "${local.name_prefix}-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_logs.arn

  depends_on = [aws_s3_bucket_policy.cloudtrail]
}
