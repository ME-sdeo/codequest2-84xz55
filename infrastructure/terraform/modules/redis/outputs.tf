# Redis Cache resource identifier output
output "redis_id" {
  description = <<-EOT
    Resource ID of the Redis Cache instance.
    Used for resource management, monitoring integration, and diagnostic settings.
    Format: /subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Cache/Redis/{name}
  EOT
  value       = azurerm_redis_cache.redis.id
  sensitive   = false
}

# Redis Cache hostname output
output "redis_hostname" {
  description = <<-EOT
    FQDN hostname of the Redis Cache instance.
    Used for application connectivity configuration.
    Format: {cacheName}.redis.cache.windows.net
  EOT
  value       = azurerm_redis_cache.redis.hostname
  sensitive   = false
}

# Redis Cache SSL port output
output "redis_ssl_port" {
  description = <<-EOT
    SSL port number for secure Redis Cache connections.
    Default port is 6380 for SSL/TLS encrypted communications.
    Non-SSL port is disabled by default for enhanced security.
  EOT
  value       = azurerm_redis_cache.redis.ssl_port
  sensitive   = false
}

# Redis Cache primary access key output
output "redis_primary_key" {
  description = <<-EOT
    Primary access key for Redis Cache authentication.
    This is a sensitive value that should be stored securely and never exposed in logs.
    Used for authenticating application connections to Redis Cache.
  EOT
  value       = azurerm_redis_cache.redis.primary_access_key
  sensitive   = true
}

# Redis Cache connection string output
output "redis_connection_string" {
  description = <<-EOT
    Primary connection string for Redis Cache with embedded credentials.
    This is a sensitive value that should be stored securely and never exposed in logs.
    Format: {cacheName}.redis.cache.windows.net:6380,password={primaryKey},ssl=True,abortConnect=False
  EOT
  value       = azurerm_redis_cache.redis.primary_connection_string
  sensitive   = true
}

# Redis Cache SSL enforcement status output
output "redis_ssl_enabled" {
  description = <<-EOT
    Indicates if non-SSL port is disabled for enhanced security.
    True indicates only SSL connections are allowed (recommended for production).
    This setting helps enforce encryption in transit.
  EOT
  value       = !azurerm_redis_cache.redis.enable_non_ssl_port
  sensitive   = false
}

# Redis Cache TLS version output
output "redis_tls_version" {
  description = <<-EOT
    Minimum TLS version supported by Redis Cache instance.
    Should be set to 1.2 for enhanced security compliance.
    Used for security auditing and compliance verification.
  EOT
  value       = azurerm_redis_cache.redis.minimum_tls_version
  sensitive   = false
}