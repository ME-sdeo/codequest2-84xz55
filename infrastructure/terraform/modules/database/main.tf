# Provider configuration
# Azure Provider version ~> 3.0
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

# Local variables for resource naming and tagging
locals {
  resource_prefix = "${var.environment}-${var.project_name}"
  tags = {
    Environment        = var.environment
    Project           = "CodeQuest"
    ManagedBy         = "Terraform"
    Criticality       = "High"
    DataClassification = "Sensitive"
  }
}

# Random string for unique server naming
resource "random_string" "server_suffix" {
  length  = 6
  special = false
  upper   = false
}

# Generate secure administrator password
resource "random_password" "administrator_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  min_special      = 2
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
}

# Primary PostgreSQL Server
resource "azurerm_postgresql_server" "primary" {
  name                = "${local.resource_prefix}-psql-${random_string.server_suffix.result}"
  location            = var.location
  resource_group_name = var.resource_group_name

  administrator_login          = var.administrator_login
  administrator_login_password = random_password.administrator_password.result

  sku_name   = var.server_sku
  version    = "14"
  storage_mb = var.storage_mb

  backup_retention_days        = 35
  geo_redundant_backup_enabled = true
  auto_grow_enabled           = true

  public_network_access_enabled    = false
  ssl_enforcement_enabled          = true
  ssl_minimal_tls_version_enforced = "TLS1_2"
  infrastructure_encryption_enabled = true

  threat_detection_policy {
    enabled              = true
    disabled_alerts      = []
    email_account_admins = true
    retention_days       = 90
  }

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags
}

# Main application database
resource "azurerm_postgresql_database" "main" {
  name                = "codequest"
  resource_group_name = var.resource_group_name
  server_name         = azurerm_postgresql_server.primary.name
  charset             = "UTF8"
  collation          = "en_US.UTF8"
}

# Private endpoint for secure access
resource "azurerm_private_endpoint" "postgresql" {
  name                = "${local.resource_prefix}-psql-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = module.network.subnet_id

  private_service_connection {
    name                           = "${local.resource_prefix}-psql-privatelink"
    private_connection_resource_id = azurerm_postgresql_server.primary.id
    is_manual_connection          = false
    subresource_names            = ["postgresqlServer"]
  }

  tags = local.tags
}

# Read replica for high availability (conditional)
resource "azurerm_postgresql_server" "replica" {
  count               = var.enable_replica ? 1 : 0
  name                = "${local.resource_prefix}-psql-replica-${random_string.server_suffix.result}"
  location            = var.location
  resource_group_name = var.resource_group_name

  create_mode               = "Replica"
  creation_source_server_id = azurerm_postgresql_server.primary.id

  sku_name   = var.server_sku
  version    = "14"
  storage_mb = var.storage_mb

  ssl_enforcement_enabled          = true
  ssl_minimal_tls_version_enforced = "TLS1_2"
  infrastructure_encryption_enabled = true

  public_network_access_enabled = false

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags
}

# Store sensitive information in Key Vault
resource "azurerm_key_vault_secret" "db_admin_password" {
  name         = "${local.resource_prefix}-psql-admin-password"
  value        = random_password.administrator_password.result
  key_vault_id = module.keyvault.key_vault_id

  content_type = "text/plain"
  tags         = local.tags
}

resource "azurerm_key_vault_secret" "connection_string" {
  name         = "${local.resource_prefix}-psql-connection-string"
  value        = "postgresql://${var.administrator_login}@${azurerm_postgresql_server.primary.name}:${random_password.administrator_password.result}@${azurerm_postgresql_server.primary.fqdn}:5432/codequest?sslmode=require"
  key_vault_id = module.keyvault.key_vault_id

  content_type = "text/plain"
  tags         = local.tags
}

# Outputs
output "server_name" {
  value       = azurerm_postgresql_server.primary.name
  description = "The name of the PostgreSQL server"
}

output "server_fqdn" {
  value       = azurerm_postgresql_server.primary.fqdn
  description = "The fully qualified domain name of the PostgreSQL server"
}

output "connection_string" {
  value       = "postgresql://${var.administrator_login}@${azurerm_postgresql_server.primary.name}:${random_password.administrator_password.result}@${azurerm_postgresql_server.primary.fqdn}:5432/codequest?sslmode=require"
  description = "PostgreSQL connection string"
  sensitive   = true
}