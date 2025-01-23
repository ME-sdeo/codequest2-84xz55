# Terraform version constraint
terraform {
  required_version = "~> 1.0"
}

# Environment variable for deployment environment identification
variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev, staging, prod)"

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Azure region for Redis Cache deployment
variable "location" {
  type        = string
  description = "Azure region for Redis Cache deployment (e.g., eastus2)"

  validation {
    condition     = can(regex("^[a-z]+[a-z0-9-]+$", var.location))
    error_message = "Location must be a valid Azure region name in lowercase with optional numbers and hyphens"
  }
}

# Resource group name for Redis Cache resources
variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group for Redis Cache deployment"

  validation {
    condition     = can(regex("^[a-zA-Z0-9-_()]{1,89}[a-zA-Z0-9-_()]$", var.resource_group_name))
    error_message = "Resource group name must be 1-90 characters and meet Azure naming requirements"
  }
}

# Redis Cache configuration settings
variable "redis_config" {
  type = object({
    sku_name    = string # Premium required for clustering
    family      = string # P for Premium tier
    capacity    = number # 1-4 for Premium tier
    shard_count = number # 1-10 shards for Premium cluster
  })

  description = "Redis Cache configuration settings for performance and scaling"

  default = {
    sku_name    = "Premium"
    family      = "P"
    capacity    = 1
    shard_count = 2
  }

  validation {
    condition     = var.redis_config.sku_name == "Premium"
    error_message = "SKU name must be Premium for clustering support"
  }

  validation {
    condition     = var.redis_config.family == "P"
    error_message = "Cache family must be P for Premium tier"
  }

  validation {
    condition     = contains([1, 2, 3, 4], var.redis_config.capacity)
    error_message = "Cache capacity must be between 1 and 4 for Premium tier"
  }

  validation {
    condition     = var.redis_config.shard_count >= 1 && var.redis_config.shard_count <= 10
    error_message = "Shard count must be between 1 and 10 for Premium cluster"
  }
}

# Redis Cache firewall rules
variable "redis_firewall_rules" {
  type = map(object({
    start_ip = string
    end_ip   = string
  }))

  description = "Map of Redis Cache firewall rules for access control"

  default = {}

  validation {
    condition = alltrue([
      for rule in var.redis_firewall_rules : can(regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$", rule.start_ip)) &&
      can(regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$", rule.end_ip))
    ])
    error_message = "IP addresses must be valid IPv4 addresses in x.x.x.x format"
  }
}