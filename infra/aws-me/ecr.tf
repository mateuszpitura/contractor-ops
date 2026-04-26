# ─────────────────────────────────────────────────────────────────────────────
# ECR repositories for the 3 container images deployed to ME.
#
# Images are built once in CI (main Dockerfiles at apps/web/Dockerfile and
# apps/public-api/Dockerfile) and pushed to ECR in this account. A lifecycle
# policy keeps the last 20 images — enough to roll back through ~2 weeks of
# deploys without unbounded storage cost.
#
# Scan-on-push runs Amazon Inspector's ECR enhanced scanning if enabled at
# account level. Enable it separately in the AWS account (one-time, free).
# ─────────────────────────────────────────────────────────────────────────────

locals {
  # De-duplicate: if ecr_repo_worker == ecr_repo_web we only create one repo.
  ecr_repos = toset([
    var.ecr_repo_web,
    var.ecr_repo_public_api,
    var.ecr_repo_worker,
  ])
}

resource "aws_ecr_repository" "this" {
  for_each             = local.ecr_repos
  name                 = each.value
  image_tag_mutability = "IMMUTABLE"  # prevent accidental tag overwrite

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "keep_last_20" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images; delete older"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = {
        type = "expire"
      }
    }]
  })
}
