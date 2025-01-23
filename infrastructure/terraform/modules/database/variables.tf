variable "resource_group_name" {
  type        = string
  description = "Name of the resource group where database resources will be deployed"

  validation {
    condition     = length(var.resource_group_name) > 0 && length(var.resource_group_name) <= 90
    error_message = "Resource group name must be between 1 and 90 characters"
  }
}

variable "location" {
  type        = string
  description = "Azure region where database resources will be deployed"

  validation {
    condition     = contains(["eastus", "westus", "northeurope", "westeurope"], var.location)
    error_message = "Location must be a supported Azure region for PostgreSQL deployments"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod) affecting resource configuration and scaling"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "project_name" {
  type        = string
  description = "Project name used for resource naming and tagging"
  default     = "codequest"

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]*$", var.project_name))
    error_message = "Project name must contain only alphanumeric characters and hyphens"
  }
}

variable "server_sku" {
  type        = string
  description = "SKU name for the PostgreSQL server defining compute capacity and performance tier"
  default     = "GP_Gen5_4"

  validation {
    condition     = can(regex("^(GP|MO)_Gen5_[2-64]$", var.server_sku))
    error_message = "Server SKU must be a valid Azure PostgreSQL SKU name"
  }
}

variable "storage_mb" {
  type        = number
  description = "Storage size in MB for the PostgreSQL server with minimum 5120 MB"
  default     = 102400

  validation {
    condition     = var.storage_mb >= 5120 && var.storage_mb <= 16777216
    error_message = "Storage must be between 5120 MB and 16 TB"
  }
}

variable "backup_retention_days" {
  type        = number
  description = "Backup retention period in days for point-in-time recovery"
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days"
  }
}

variable "geo_redundant_backup" {
  type        = bool
  description = "Enable geo-redundant backups for disaster recovery"
  default     = true
}

variable "enable_replica" {
  type        = bool
  description = "Enable read replica for high availability and read scaling"
  default     = true
}

variable "administrator_login" {
  type        = string
  description = "Administrator username for PostgreSQL server access"
  default     = "codequest_admin"

  validation {
    condition     = length(var.administrator_login) >= 8 && can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.administrator_login))
    error_message = "Administrator login must be at least 8 characters, start with a letter, and contain only alphanumeric characters or underscores"
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all database resources for organization and cost tracking"
  default = {
    Project     = "CodeQuest"
    ManagedBy   = "Terraform"
    Environment = "var.environment"
  }
}