# Key Vault resource ID output for RBAC assignments and access configuration
output "key_vault_id" {
  description = "The Azure resource ID of the Key Vault used for RBAC assignments and access configuration"
  value       = azurerm_key_vault.main.id
  sensitive   = false # Resource ID is safe to expose as it's needed for RBAC
}

# Key Vault URI output for authenticated access to secrets and keys
output "key_vault_uri" {
  description = "The URI endpoint of the Key Vault for accessing secrets and keys with proper authentication"
  value       = azurerm_key_vault.main.vault_uri
  sensitive   = false # URI is safe to expose as it requires authentication to access
}

# Key Vault name output for logging and reference
output "key_vault_name" {
  description = "The name of the Key Vault resource used for logging and reference"
  value       = azurerm_key_vault.main.name
  sensitive   = false # Name is safe to expose for logging purposes
}

# HSM-protected encryption key ID output for secure AES-256 encryption
output "encryption_key_id" {
  description = "The resource ID of the HSM-protected encryption key used for AES-256 encryption"
  value       = azurerm_key_vault_key.app_encryption.id
  sensitive   = true # Key ID should be treated as sensitive to prevent unauthorized access
}