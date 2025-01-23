# Azure CDN module for CodeQuest static asset delivery
# Provider version: ~> 3.0

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

locals {
  cdn_profile_name                  = "${var.project_name}-cdn-${var.environment}"
  cdn_endpoint_name                 = "${var.project_name}-endpoint-${var.environment}"
  default_cache_duration           = "3d"
  compression_enabled              = true
  query_string_caching_behaviour   = "IgnoreQueryString"
  optimization_type               = "GeneralWebDelivery"
  health_probe_interval           = 60
}

# Azure CDN Profile
resource "azurerm_cdn_profile" "main" {
  name                = local.cdn_profile_name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.cdn_sku

  tags = merge(var.tags, {
    environment = var.environment
  })
}

# Azure CDN Endpoint
resource "azurerm_cdn_endpoint" "main" {
  name                = local.cdn_endpoint_name
  profile_name        = azurerm_cdn_profile.main.name
  location            = var.location
  resource_group_name = var.resource_group_name

  origin {
    name       = "primary"
    host_name  = var.origin_hostname
    http_port  = 80
    https_port = 443
  }

  origin_host_header = var.origin_hostname

  is_compression_enabled = local.compression_enabled
  optimization_type      = local.optimization_type
  
  # Global delivery rule for security headers and caching
  global_delivery_rule {
    cache_expiration_action {
      behavior = "Override"
      duration = local.default_cache_duration
    }

    modify_response_header_action {
      action = "Append"
      name   = "Strict-Transport-Security"
      value  = "max-age=31536000; includeSubDomains"
    }

    modify_response_header_action {
      action = "Append"
      name   = "X-Content-Type-Options"
      value  = "nosniff"
    }

    modify_response_header_action {
      action = "Append"
      name   = "X-Frame-Options"
      value  = "DENY"
    }
  }

  # Cache configuration for static assets
  delivery_rule {
    name  = "CacheStaticFiles"
    order = 1

    request_scheme_condition {
      match_values = ["HTTP", "HTTPS"]
    }

    url_file_extension_condition {
      match_values = ["js", "css", "png", "jpg", "jpeg", "gif", "svg", "ico", "woff", "woff2"]
    }

    cache_expiration_action {
      behavior = "Override"
      duration = local.default_cache_duration
    }
  }

  # Force HTTPS
  delivery_rule {
    name  = "ForceHTTPS"
    order = 2

    request_scheme_condition {
      match_values = ["HTTP"]
    }

    url_redirect_action {
      redirect_type = "PermanentRedirect"
      protocol      = "Https"
    }
  }

  # Query string handling
  query_string_caching_behaviour = local.query_string_caching_behaviour

  # Probe settings
  probe_path = "/health"
  probe_protocol = "Https"
  probe_interval_in_seconds = local.health_probe_interval

  # WAF policy association (when using Premium SKU)
  dynamic "web_application_firewall_policy_link" {
    for_each = var.cdn_sku == "Premium" ? [1] : []
    content {
      id = azurerm_cdn_frontdoor_firewall_policy.waf[0].id
    }
  }

  tags = merge(var.tags, {
    environment = var.environment
  })
}

# WAF Policy for Premium SKU
resource "azurerm_cdn_frontdoor_firewall_policy" "waf" {
  count               = var.cdn_sku == "Premium" ? 1 : 0
  name                = "${local.cdn_profile_name}-waf"
  resource_group_name = var.resource_group_name
  sku_name            = var.cdn_sku

  custom_block_response_status_code = 403
  custom_block_response_body       = "Access denied by WAF policy"

  managed_rule {
    type    = "DefaultRuleSet"
    version = "1.0"
  }

  managed_rule {
    type    = "Microsoft_BotManagerRuleSet"
    version = "1.0"
  }

  tags = merge(var.tags, {
    environment = var.environment
  })
}

# Diagnostic settings for monitoring
resource "azurerm_monitor_diagnostic_setting" "cdn_diagnostics" {
  name                       = "${local.cdn_profile_name}-diagnostics"
  target_resource_id         = azurerm_cdn_profile.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  log {
    category = "AzureCdnAccessLog"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }
}