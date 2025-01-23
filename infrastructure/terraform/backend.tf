# Backend configuration for CodeQuest infrastructure state management
# Version: azurerm ~> 3.0

terraform {
  backend "azurerm" {
    # Environment-specific resource group for state storage
    resource_group_name = var.resource_group_name

    # Globally unique storage account name with environment suffix
    storage_account_name = "codequeststate${var.environment}${random_string.unique.result}"
    
    # Container and state file configuration
    container_name = "tfstate"
    key = "${var.environment}/terraform.tfstate"

    # Authentication using Managed Identity
    use_msi = true
    subscription_id = var.subscription_id
    tenant_id = var.tenant_id

    # Enhanced security configuration
    enable_blob_encryption = true
    min_tls_version = "TLS1_2"
    allow_blob_public_access = false
    enable_https_traffic_only = true

    # State locking configuration
    use_state_locking = true
    lease_duration = "60"

    # Soft delete and versioning
    versioning_enabled = true
    soft_delete_retention_days = 30

    # Network security
    ip_rules = []  # Configured via storage account network rules
    virtual_network_subnet_ids = []  # Configured via storage account network rules

    # Diagnostic settings
    enable_diagnostic_settings = true
    diagnostic_settings_name = "tfstate-diagnostics"
    diagnostic_settings_retention_days = 90
  }

  # Required provider configuration
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Random string for storage account name uniqueness
resource "random_string" "unique" {
  length  = 6
  special = false
  upper   = false
}

# Configure backend state storage with enhanced security features
resource "azurerm_storage_account_network_rules" "tfstate" {
  storage_account_id = azurerm_storage_account.tfstate.id

  default_action = "Deny"
  bypass = ["AzureServices"]
  ip_rules = []  # Configure with specific IP ranges in production
  virtual_network_subnet_ids = []  # Configure with specific subnet IDs in production
}

# Configure diagnostic settings for state storage auditing
resource "azurerm_monitor_diagnostic_setting" "tfstate" {
  name                       = "tfstate-diagnostics"
  target_resource_id        = azurerm_storage_account.tfstate.id
  storage_account_id        = azurerm_storage_account.tfstate.id

  enabled_log {
    category = "StorageRead"
    retention_policy {
      enabled = true
      days    = 90
    }
  }

  enabled_log {
    category = "StorageWrite"
    retention_policy {
      enabled = true
      days    = 90
    }
  }

  enabled_log {
    category = "StorageDelete"
    retention_policy {
      enabled = true
      days    = 90
    }
  }

  metric {
    category = "Transaction"
    retention_policy {
      enabled = true
      days    = 90
    }
  }
}

# Configure backup policy for state files
resource "azurerm_backup_container_storage_account" "tfstate" {
  resource_group_name = var.resource_group_name
  recovery_vault_name = azurerm_recovery_services_vault.tfstate.name
  storage_account_id  = azurerm_storage_account.tfstate.id
}

resource "azurerm_backup_policy_file_share" "tfstate" {
  name                = "tfstate-backup-policy"
  resource_group_name = var.resource_group_name
  recovery_vault_name = azurerm_recovery_services_vault.tfstate.name

  backup {
    frequency = "Daily"
    time      = "23:00"
  }

  retention_daily {
    count = 30
  }

  retention_weekly {
    count    = 12
    weekdays = ["Sunday"]
  }

  retention_monthly {
    count    = 12
    weekdays = ["Sunday"]
    weeks    = ["First"]
  }

  retention_yearly {
    count    = 1
    weekdays = ["Sunday"]
    weeks    = ["First"]
    months   = ["January"]
  }
}