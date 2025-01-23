# Terraform outputs file for CodeQuest infrastructure
# terraform ~> 1.0
# azurerm ~> 3.0

# Azure Key Vault URI output
output "key_vault_uri" {
  description = "The URI of the Azure Key Vault for secret management"
  value       = module.keyvault.vault_uri
  sensitive   = false # URI itself is not sensitive
}

# Database connection string with secure handling
output "database_connection_string" {
  description = "Secured PostgreSQL database connection string"
  value       = format_connection_string(module.database.connection_string)
  sensitive   = true
}

# Redis cache connection information
output "redis_connection_info" {
  description = "Redis cache connection details"
  value = {
    host = module.redis.hostname
    port = module.redis.port
  }
  sensitive = false # Basic connection info is not sensitive
}

# AKS cluster credentials
output "aks_cluster_credentials" {
  description = "AKS cluster credentials for deployment"
  value = {
    kube_config = module.aks.kube_config
  }
  sensitive = true
}

# Helper function to format and secure database connection string
locals {
  format_connection_string = function(connection_string) {
    # Ensure the connection string is marked as sensitive
    sensitive(
      # Format: "host=host port=port dbname=name user=user password=pass sslmode=require"
      replace(
        connection_string,
        "/password=[^\\s]+/",
        "password=${sensitive(module.database.password)}"
      )
    )
  }
}

# Validation to ensure required outputs are available
locals {
  validate_outputs = {
    # Verify Key Vault URI format
    key_vault_check = regex("^https://[a-zA-Z0-9-]+\\.vault\\.azure\\.net/$", module.keyvault.vault_uri)
    
    # Verify Redis port is in valid range
    redis_port_check = module.redis.port >= 1 && module.redis.port <= 65535
    
    # Verify kube_config is present
    kube_config_check = length(module.aks.kube_config) > 0
  }
}