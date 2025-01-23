# Provider configuration with enhanced security features
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  backend "azurerm" {
    # Backend configuration should be provided via backend config file
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}

# Local variables for enhanced resource naming and tagging
locals {
  common_tags = {
    Environment         = var.environment
    Project            = "CodeQuest"
    ManagedBy          = "Terraform"
    CostCenter         = "Engineering"
    DataClassification = "Confidential"
    BusinessUnit       = "Engineering"
  }

  # Resource naming convention
  name_prefix = "cq-${var.environment}"
  primary_location_suffix = replace(var.primary_location, " ", "")
  secondary_location_suffix = replace(var.secondary_location, " ", "")
}

# Random suffix for globally unique names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Primary region resource group
resource "azurerm_resource_group" "primary" {
  name     = "${var.resource_group_name}-${var.primary_location}"
  location = var.primary_location
  tags     = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

# Secondary region resource group for disaster recovery
resource "azurerm_resource_group" "secondary" {
  name     = "${var.resource_group_name}-${var.secondary_location}"
  location = var.secondary_location
  tags     = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

# Primary AKS cluster
module "primary_aks" {
  source = "./modules/aks"

  resource_group_name = azurerm_resource_group.primary.name
  location           = azurerm_resource_group.primary.location
  cluster_name       = "${local.name_prefix}-aks-${local.primary_location_suffix}"
  kubernetes_version = var.aks_config.kubernetes_version
  node_count         = var.aks_config.node_count
  vm_size           = var.aks_config.vm_size
  
  enable_auto_scaling = var.aks_config.enable_auto_scaling
  min_node_count     = var.aks_config.min_node_count
  max_node_count     = var.aks_config.max_node_count
  availability_zones = var.aks_config.availability_zones
  
  network_plugin     = var.aks_config.network_plugin
  network_policy     = var.aks_config.network_policy
  pod_cidr          = var.aks_config.pod_cidr
  service_cidr      = var.aks_config.service_cidr
  dns_service_ip    = var.aks_config.dns_service_ip
  
  tags = local.common_tags
}

# Secondary AKS cluster for disaster recovery
module "secondary_aks" {
  source = "./modules/aks"

  resource_group_name = azurerm_resource_group.secondary.name
  location           = azurerm_resource_group.secondary.location
  cluster_name       = "${local.name_prefix}-aks-${local.secondary_location_suffix}"
  kubernetes_version = var.aks_config.kubernetes_version
  node_count         = var.aks_config.node_count
  vm_size           = var.aks_config.vm_size
  
  enable_auto_scaling = var.aks_config.enable_auto_scaling
  min_node_count     = var.aks_config.min_node_count
  max_node_count     = var.aks_config.max_node_count
  availability_zones = var.aks_config.availability_zones
  
  network_plugin     = var.aks_config.network_plugin
  network_policy     = var.aks_config.network_policy
  pod_cidr          = var.aks_config.pod_cidr
  service_cidr      = var.aks_config.service_cidr
  dns_service_ip    = var.aks_config.dns_service_ip
  
  tags = local.common_tags
}

# Primary PostgreSQL database
module "primary_database" {
  source = "./modules/database"

  resource_group_name = azurerm_resource_group.primary.name
  location           = azurerm_resource_group.primary.location
  server_name        = "${local.name_prefix}-psql-${local.primary_location_suffix}-${random_string.suffix.result}"
  
  version                    = var.database_config.version
  sku_name                   = var.database_config.sku_name
  storage_mb                 = var.database_config.storage_mb
  backup_retention_days      = var.database_config.backup_retention_days
  geo_redundant_backup      = var.database_config.geo_redundant_backup
  auto_grow_enabled         = var.database_config.auto_grow_enabled
  public_network_access     = var.database_config.public_network_access
  ssl_enforcement           = var.database_config.ssl_enforcement
  minimum_tls_version       = var.database_config.minimum_tls_version
  infrastructure_encryption = var.database_config.infrastructure_encryption
  
  tags = local.common_tags
}

# Database replica in secondary region
module "secondary_database" {
  count  = var.database_config.enable_replica ? 1 : 0
  source = "./modules/database"

  resource_group_name = azurerm_resource_group.secondary.name
  location           = azurerm_resource_group.secondary.location
  server_name        = "${local.name_prefix}-psql-${local.secondary_location_suffix}-${random_string.suffix.result}"
  
  version                    = var.database_config.version
  sku_name                   = var.database_config.sku_name
  storage_mb                 = var.database_config.storage_mb
  backup_retention_days      = var.database_config.backup_retention_days
  geo_redundant_backup      = var.database_config.geo_redundant_backup
  auto_grow_enabled         = var.database_config.auto_grow_enabled
  public_network_access     = var.database_config.public_network_access
  ssl_enforcement           = var.database_config.ssl_enforcement
  minimum_tls_version       = var.database_config.minimum_tls_version
  infrastructure_encryption = var.database_config.infrastructure_encryption
  
  is_replica = true
  primary_server_id = module.primary_database.server_id
  
  tags = local.common_tags
}

# Output resource identifiers
output "resource_group_ids" {
  value = {
    primary   = azurerm_resource_group.primary.id
    secondary = azurerm_resource_group.secondary.id
  }
  description = "Resource group IDs for both primary and secondary regions"
}

output "aks_cluster_endpoints" {
  value = {
    primary   = module.primary_aks.cluster_endpoint
    secondary = module.secondary_aks.cluster_endpoint
  }
  description = "AKS cluster endpoints for application deployment"
  sensitive   = true
}

output "database_connection_strings" {
  value = {
    primary = module.primary_database.connection_string
    replica = var.database_config.enable_replica ? module.secondary_database[0].connection_string : null
  }
  description = "Database connection strings including replicas"
  sensitive   = true
}