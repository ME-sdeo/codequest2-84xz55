# Input variables for Azure Key Vault configuration
variable "name_prefix" {
  type        = string
  description = "Prefix for the key vault name, must follow Azure naming conventions"
  default     = "codequest-kv"
  validation {
    condition     = can(regex("^[a-z0-9-]{1,16}$", var.name_prefix))
    error_message = "Name prefix must be 1-16 characters, lowercase alphanumeric or hyphens"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod) with strict validation"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "location" {
  type        = string
  description = "Azure region where key vault will be deployed with geo-redundancy support"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group for key vault deployment"
}

variable "sku_name" {
  type        = string
  description = "SKU name for key vault (Premium required for HSM backing and enhanced security features)"
  default     = "Premium"
  validation {
    condition     = contains(["Premium", "Standard"], var.sku_name)
    error_message = "SKU name must be either Premium or Standard"
  }
}

variable "enabled_for_disk_encryption" {
  type        = bool
  description = "Enable key vault for disk encryption with AES-256"
  default     = true
}

variable "soft_delete_retention_days" {
  type        = number
  description = "Retention period for soft-deleted keys and secrets (90 days maximum for compliance)"
  default     = 90
  validation {
    condition     = var.soft_delete_retention_days >= 7 && var.soft_delete_retention_days <= 90
    error_message = "Retention days must be between 7 and 90 days for compliance"
  }
}

variable "purge_protection_enabled" {
  type        = bool
  description = "Enable purge protection for key vault to prevent unauthorized key deletion"
  default     = true
}

variable "enable_rbac_authorization" {
  type        = bool
  description = "Enable RBAC authorization for enhanced access control"
  default     = true
}

variable "geo_redundant_backup" {
  type        = bool
  description = "Enable geo-redundant backup for disaster recovery"
  default     = true
}

variable "network_acls" {
  type = object({
    default_action             = string
    bypass                     = string
    ip_rules                   = list(string)
    virtual_network_subnet_ids = list(string)
    allowed_service_endpoints  = list(string)
  })
  description = "Comprehensive network access control settings for key vault"
  default = {
    default_action             = "Deny"
    bypass                     = "AzureServices"
    ip_rules                   = []
    virtual_network_subnet_ids = []
    allowed_service_endpoints  = ["Microsoft.KeyVault"]
  }
  validation {
    condition     = contains(["Allow", "Deny"], var.network_acls.default_action)
    error_message = "Network ACLs default_action must be either Allow or Deny"
  }
  validation {
    condition     = contains(["AzureServices", "None"], var.network_acls.bypass)
    error_message = "Network ACLs bypass must be either AzureServices or None"
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to key vault resource for resource management"
  default = {
    Service       = "Key Vault"
    ManagedBy     = "Terraform"
    Environment   = "var.environment"
    SecurityLevel = "Critical"
  }
}