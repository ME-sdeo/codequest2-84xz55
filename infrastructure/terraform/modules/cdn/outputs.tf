# CDN Profile outputs
output "cdn_profile_id" {
  value       = azurerm_cdn_profile.main.id
  description = "The resource ID of the Azure CDN profile for integration with other resources and monitoring configuration"
}

output "cdn_profile_name" {
  value       = azurerm_cdn_profile.main.name
  description = "The name of the Azure CDN profile for reference in logging and monitoring configurations"
}

output "cdn_profile_sku" {
  value       = azurerm_cdn_profile.main.sku
  description = "The SKU of the CDN profile for cost tracking and performance tier verification"
}

# CDN Endpoint outputs
output "cdn_endpoint_id" {
  value       = azurerm_cdn_endpoint.main.id
  description = "The resource ID of the Azure CDN endpoint for integration with application and monitoring resources"
}

output "cdn_endpoint_hostname" {
  value       = azurerm_cdn_endpoint.main.host_name
  description = "The hostname of the CDN endpoint for configuring DNS and application routing to enable global content delivery"
}

output "cdn_endpoint_ssl_status" {
  value       = azurerm_cdn_endpoint.main.is_https_allowed
  description = "The HTTPS status of the CDN endpoint for security compliance monitoring"
}

output "cdn_endpoint_optimization" {
  value       = azurerm_cdn_endpoint.main.optimization_type
  description = "The optimization type configured for the CDN endpoint to ensure sub-500ms response times"
}

# Origin configuration outputs
output "cdn_endpoint_origin_host" {
  value       = azurerm_cdn_endpoint.main.origin_host_header
  description = "The origin host header configuration for the CDN endpoint"
}

# WAF policy outputs (for Premium SKU)
output "cdn_waf_policy_id" {
  value       = var.cdn_sku == "Premium" ? azurerm_cdn_frontdoor_firewall_policy.waf[0].id : null
  description = "The resource ID of the WAF policy associated with the Premium CDN endpoint (null for Standard SKU)"
}

# Monitoring outputs
output "cdn_diagnostic_settings_id" {
  value       = azurerm_monitor_diagnostic_setting.cdn_diagnostics.id
  description = "The resource ID of the diagnostic settings configured for CDN monitoring"
}