# ─────────────────────────────────────────────────────────────────────────────
# Terraform + provider pins for the AWS ME region stack.
#
# Keep pins tight — this stack may be dormant for months between applies, and
# provider drift during that window is the #1 source of failed ME emergency
# cutovers. Bump intentionally, review changelogs, apply on a staging-style
# env first (e.g. `terraform workspace new dryrun` against a throwaway AWS
# account) before touching production ME.
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state lives in the SAME region as the stack it describes — so if
  # us-east-1 has an S3 outage, ME is not blocked from running terraform apply.
  # Create the bucket + DynamoDB lock table manually (bootstrap.sh — see README)
  # BEFORE the first apply. State contains DB passwords → enable S3 encryption,
  # block public access, versioning, and restrict IAM access tightly.
  backend "s3" {
    # Fill these in via `terraform init -backend-config=...` or a CI secret.
    # Do NOT hardcode them — different envs (prod / dryrun) need different
    # buckets and lock tables.
    # bucket         = "contractor-ops-tfstate-me-south-1"
    # key            = "aws-me/terraform.tfstate"
    # region         = "me-south-1"
    # dynamodb_table = "contractor-ops-tfstate-locks"
    # encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project      = "contractor-ops"
      Stack        = "aws-me"
      ManagedBy    = "terraform"
      DataResidency = "ME"
      Environment  = var.environment
    }
  }
}
