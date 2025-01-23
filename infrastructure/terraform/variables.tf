# Core deployment variables
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "location" {
  type        = string
  description = "Azure region where resources will be deployed"
  default     = "eastus"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group for all CodeQuest resources"
}

variable "tags" {
  type        = map(string)
  description = "Common tags to apply to all resources"
  default = {
    Project    = "CodeQuest"
    ManagedBy  = "Terraform"
  }
}

# AKS cluster configuration
variable "aks_config" {
  type = object({
    kubernetes_version    = string
    node_count           = number
    vm_size              = string
    enable_auto_scaling  = bool
    min_node_count       = number
    max_node_count       = number
    availability_zones   = list(string)
    network_plugin      = string
    network_policy      = string
    pod_cidr           = string
    service_cidr       = string
    dns_service_ip     = string
    docker_bridge_cidr = string
  })
  description = "Configuration for AKS cluster"
  default = {
    kubernetes_version    = "1.25.0"
    node_count           = 3
    vm_size              = "Standard_DS2_v2"
    enable_auto_scaling  = true
    min_node_count       = 3
    max_node_count       = 10
    availability_zones   = ["1", "2", "3"]
    network_plugin      = "azure"
    network_policy      = "calico"
    pod_cidr           = "10.244.0.0/16"
    service_cidr       = "10.0.0.0/16"
    dns_service_ip     = "10.0.0.10"
    docker_bridge_cidr = "172.17.0.1/16"
  }
}

# PostgreSQL database configuration
variable "database_config" {
  type = object({
    version                     = string
    sku_name                    = string
    storage_mb                  = number
    backup_retention_days       = number
    geo_redundant_backup       = bool
    enable_replica             = bool
    auto_grow_enabled          = bool
    public_network_access      = bool
    ssl_enforcement            = string
    minimum_tls_version        = string
    infrastructure_encryption  = bool
  })
  description = "Configuration for PostgreSQL database"
  default = {
    version                     = "14"
    sku_name                    = "GP_Gen5_4"
    storage_mb                  = 102400
    backup_retention_days       = 35
    geo_redundant_backup       = true
    enable_replica             = true
    auto_grow_enabled          = true
    public_network_access      = false
    ssl_enforcement            = "Enabled"
    minimum_tls_version        = "TLS1_2"
    infrastructure_encryption  = true
  }
}

# Redis cache configuration
variable "redis_config" {
  type = object({
    sku_name               = string
    family                 = string
    capacity               = number
    enable_non_ssl_port    = bool
    minimum_tls_version    = string
    shard_count           = number
    enable_authentication = bool
    enable_backup         = bool
    backup_frequency      = number
    backup_retention_days = number
    zone_redundant        = bool
  })
  description = "Configuration for Redis cache"
  default = {
    sku_name               = "Premium"
    family                 = "P"
    capacity               = 1
    enable_non_ssl_port    = false
    minimum_tls_version    = "1.2"
    shard_count           = 3
    enable_authentication = true
    enable_backup         = true
    backup_frequency      = 60
    backup_retention_days = 14
    zone_redundant        = true
  }
}