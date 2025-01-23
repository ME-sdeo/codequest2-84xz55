# Azure Key Vault configuration with HSM-backed encryption and enhanced security
# Provider versions: azurerm ~> 3.0, random ~> 3.0

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Get current Azure configuration
data "azurerm_client_config" "current" {}

# Local variables for enhanced configuration
locals {
  default_tags = {
    Environment         = var.environment
    ManagedBy          = "Terraform"
    Service            = "Key Vault"
    SecurityLevel      = "Critical"
    DataClassification = "Confidential"
    BackupEnabled      = "true"
  }
  
  # Merge default tags with provided tags
  tags = merge(local.default_tags, var.tags)
}

# Generate cryptographically secure random suffix for globally unique vault name
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
  numeric = true
  min_numeric = 2
  min_lower = 2
}

# Azure Key Vault with Premium SKU and HSM backing
resource "azurerm_key_vault" "main" {
  name                            = "${var.name_prefix}-${var.environment}-${random_string.suffix.result}"
  location                        = var.location
  resource_group_name            = var.resource_group_name
  tenant_id                      = data.azurerm_client_config.current.tenant_id
  sku_name                       = var.sku_name
  enabled_for_disk_encryption    = var.enabled_for_disk_encryption
  enabled_for_template_deployment = false # Security best practice
  enabled_for_deployment         = false # Security best practice
  soft_delete_retention_days     = var.soft_delete_retention_days
  purge_protection_enabled       = var.purge_protection_enabled
  enable_rbac_authorization      = var.enable_rbac_authorization
  public_network_access_enabled  = false # Enhanced security

  # Network access controls
  network_acls {
    default_action             = var.network_acls.default_action
    bypass                     = var.network_acls.bypass
    ip_rules                   = var.network_acls.ip_rules
    virtual_network_subnet_ids = var.network_acls.virtual_network_subnet_ids
  }

  # Contact information for security notifications
  contact {
    email = "security@codequest.com"
    name  = "Security Team"
    phone = "1234567890"
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true # Prevent accidental deletion
  }
}

# HSM-protected encryption key with automated rotation
resource "azurerm_key_vault_key" "app_encryption" {
  name         = "app-encryption-key"
  key_vault_id = azurerm_key_vault.main.id
  key_type     = "RSA-HSM"
  key_size     = 4096
  key_opts     = [
    "decrypt",
    "encrypt",
    "sign",
    "verify",
    "wrapKey",
    "unwrapKey"
  ]

  # Automated key rotation policy
  rotation_policy {
    automatic {
      time_after_creation = "P90D"  # 90 days rotation
      time_before_expiry = "P30D"   # Notify 30 days before expiry
      notify_before_expiry = "P7D"  # Additional notification 7 days before
    }
    expire_after = "P365D"          # Keys expire after 1 year
    notify_contacts = true
  }

  depends_on = [azurerm_key_vault.main]
}

# Outputs for reference and integration
output "key_vault_id" {
  description = "The ID of the Key Vault"
  value       = azurerm_key_vault.main.id
  sensitive   = true
}

output "key_vault_uri" {
  description = "The URI of the Key Vault"
  value       = azurerm_key_vault.main.vault_uri
  sensitive   = true
}

output "key_vault_name" {
  description = "The name of the Key Vault"
  value       = azurerm_key_vault.main.name
}

output "encryption_key_id" {
  description = "The ID of the encryption key"
  value       = azurerm_key_vault_key.app_encryption.id
  sensitive   = true
}