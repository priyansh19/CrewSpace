terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "crewspace-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "crewspace-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "crewspace"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

module "ecr" {
  source = "../../modules/ecr"

  repository_name = "crewspace"
  force_delete    = false
}

module "eks" {
  source = "../../modules/eks"

  cluster_name        = "crewspace-production"
  environment         = "production"
  domain_name         = var.domain_name
  node_desired_size   = 3
  node_min_size       = 2
  node_max_size       = 10
  node_instance_types = ["t3.large", "t3.xlarge"]
}
