# Server name output for reference
output "server_name" {
  description = "The name of the PostgreSQL server instance in Azure"
  value       = azurerm_postgresql_server.primary.name
}

# Server FQDN output for connection configuration
output "server_fqdn" {
  description = "The fully qualified domain name of the PostgreSQL server for connection configuration"
  value       = azurerm_postgresql_server.primary.fqdn
}

# Database name output for application configuration
output "database_name" {
  description = "The name of the main application database for CodeQuest"
  value       = azurerm_postgresql_database.main.name
}

# Complete connection string marked as sensitive
output "connection_string" {
  description = "Complete PostgreSQL connection string including credentials - handle with care"
  value       = "postgresql://${azurerm_postgresql_server.primary.administrator_login}@${azurerm_postgresql_server.primary.name}:${random_password.administrator_password.result}@${azurerm_postgresql_server.primary.fqdn}:5432/${azurerm_postgresql_database.main.name}?sslmode=require"
  sensitive   = true
}

# Resource ID output for IAM and networking configuration
output "resource_id" {
  description = "The Azure resource ID of the PostgreSQL server for IAM and networking configuration"
  value       = azurerm_postgresql_server.primary.id
}

# Replica server name output (conditional)
output "replica_server_name" {
  description = "The name of the PostgreSQL replica server (if enabled)"
  value       = var.enable_replica ? azurerm_postgresql_server.replica[0].name : null
}

# Replica FQDN output (conditional)
output "replica_server_fqdn" {
  description = "The fully qualified domain name of the PostgreSQL replica server (if enabled)"
  value       = var.enable_replica ? azurerm_postgresql_server.replica[0].fqdn : null
}

# Key Vault reference for connection string
output "connection_string_secret_id" {
  description = "The Key Vault secret ID containing the database connection string"
  value       = azurerm_key_vault_secret.connection_string.id
  sensitive   = true
}

# Administrator username output
output "administrator_login" {
  description = "The administrator username for the PostgreSQL server"
  value       = azurerm_postgresql_server.primary.administrator_login
}

# Server version output
output "server_version" {
  description = "The version of PostgreSQL running on the server"
  value       = azurerm_postgresql_server.primary.version
}