# Provider configuration
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
  redis_name = format("cq-redis-%s-%s", var.environment, random_string.suffix.result)
  common_tags = {
    Environment         = var.environment
    Project            = "CodeQuest"
    Component          = "Cache"
    ManagedBy          = "Terraform"
    CostCenter         = "Platform"
    SecurityLevel      = "High"
    DataClassification = "Internal"
  }
}

# Random string for unique Redis Cache naming
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Azure Cache for Redis instance
resource "azurerm_redis_cache" "redis" {
  name                          = local.redis_name
  location                      = var.location
  resource_group_name           = var.resource_group_name
  sku_name                      = var.redis_config.sku_name
  family                        = var.redis_config.family
  capacity                      = var.redis_config.capacity
  enable_non_ssl_port          = false
  minimum_tls_version          = "1.2"
  public_network_access_enabled = false
  shard_count                  = var.redis_config.shard_count

  redis_configuration {
    maxmemory_reserved              = var.redis_config.maxmemory_reserved
    maxmemory_delta                 = var.redis_config.maxmemory_delta
    maxmemory_policy                = "allkeys-lru"
    enable_authentication           = true
    aof_backup_enabled             = true
    rdb_backup_enabled             = true
    rdb_backup_frequency           = 60
    rdb_backup_max_snapshot_count  = 1
  }

  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 2
  }

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

# Redis Cache firewall rules
resource "azurerm_redis_firewall_rule" "rules" {
  for_each            = var.redis_firewall_rules
  name                = each.key
  redis_cache_name    = azurerm_redis_cache.redis.name
  resource_group_name = var.resource_group_name
  start_ip           = each.value.start_ip
  end_ip             = each.value.end_ip
}

# Diagnostic settings for monitoring
resource "azurerm_monitor_diagnostic_setting" "redis_diagnostics" {
  name                       = format("%s-diagnostics", local.redis_name)
  target_resource_id         = azurerm_redis_cache.redis.id
  log_analytics_workspace_id = var.monitoring_config.workspace_id

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Outputs
output "redis_cache_id" {
  description = "The ID of the Redis Cache instance"
  value       = azurerm_redis_cache.redis.id
}

output "redis_hostname" {
  description = "The hostname of the Redis Cache instance"
  value       = azurerm_redis_cache.redis.hostname
}

output "redis_ssl_port" {
  description = "The SSL port of the Redis Cache instance"
  value       = azurerm_redis_cache.redis.ssl_port
}

output "redis_primary_access_key" {
  description = "The primary access key for the Redis Cache instance"
  value       = azurerm_redis_cache.redis.primary_access_key
  sensitive   = true
}

output "redis_primary_connection_string" {
  description = "The primary connection string for the Redis Cache instance"
  value       = azurerm_redis_cache.redis.primary_connection_string
  sensitive   = true
}

output "redis_shard_count" {
  description = "The number of shards in the Redis Cache cluster"
  value       = azurerm_redis_cache.redis.shard_count
}

output "redis_cluster_enabled" {
  description = "Whether clustering is enabled for the Redis Cache instance"
  value       = var.redis_config.shard_count > 1
}