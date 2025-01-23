CodeQuest is a SAAS service for gamifying development within Azure DevOps (ADO) within companies.

The Gamification aspect for development provides points to each team member for various activities that ADO can track such as code checkins, pull requests, code reviews, bug fixes, closing stories etc, basically any activity that can be tracked within ADO using native API's available in ADO. There are various levels to attain based on the total points you accrue. Each level can earn you badges that can be displayed against your name, and earn rewards as well.

Each company can have multiple orgs within it, and each org can have multiple teams, and each team can have multiple members. Members can belong to multiple teams.

The SAAS service can work with multiple companies simultaneously and independently. Within each company, there will be a super admin role, who can create multiple Org Admins, Each Org Admin can create multiple teams and assign individual developers to teams. Each Org Admin is responsible for setting up the following for all teams in that Org.

WHY – Vision & Purpose

1\. Purpose & Users

Primary Problem to Solve:

Encourage and reward developers’ productivity by gamifying Azure DevOps (ADO) activities, leading to higher engagement and motivation within development teams.

Target Users

Companies looking to enhance their internal development culture.

Company Admins setting up multiple Orgs.

Org Admins managing teams and point configurations.

Developers who accrue points for their work.

General Authenticated Users who can view teams and performance metrics.

Value Proposition

Provide a single SaaS solution that integrates with Azure DevOps to track, score, and reward team members for code check-ins, pull requests, reviews, bug fixes and other directly trackable activities within ADO or even indirectly trackable activities such as closing specificly marked tickets within ADO.

Present leaderboards, point systems, and badges to boost friendly competition and developer satisfaction.

(Potential Names: “CodeQuest”)

WHAT – Core Requirements

2\. Functional Requirements

Core Features

System must:

Allow Multi-Company SaaS

Support multiple companies simultaneously and independently.

Each company can have multiple Orgs, each Org can have multiple Teams, and each Team can have multiple Members.

Provide tiered offerings for Companies:

Small: 1 Org, 10 Teams

Medium: Up to 5 Orgs, 50 Teams total

Enterprise: Up to 100 Orgs, 10,000 Teams

User and Role Management

Super Admin: Overall platform management (internal to SaaS).

Company Admin: Sets up SSO, creates Orgs, designates Org Admins, Sets up company-wide default points table, authenticates the ADO plugin.

Org Admin: Configures point values which overrides the default company wide points table, creates teams, adds/removes, assigns or reassigns developers to teams.

Developer: Earns points for activities across one or more teams.

General Authenticated User: Views team stats and data but does not accrue points.

ADO Integration Plugin

Published on Azure Marketplace.

Company Admin must authenticate the plugin to the SaaS platform for data flow.

Collects data on ADO activities (code check-ins, PRs, code reviews, bug fixes, story closures).

Sends secure API calls to the SaaS to update metrics in near real-time.

Points & Levels

Default global table of point values for activities (configurable at the company level).

Org Admin can override these point assignments to tailor Activity point values for each Org.

Fixed maximum of 20 levels within each Company. Each level has:

A Name (e.g., Diamond, Gold, Bronze)

A qualifying points threshold

An associated badge (visual representation)

Gamification Mechanics

Activities in ADO → Points assigned to the user in that team.

Each user can earn separate points per team if they belong to multiple teams.

Once a user’s total points in a team surpass a level’s threshold, they are awarded that level’s badge.

User Interfaces

Admin UI (React-based):

Company registration & basic SSO integration setup (SAML, OpenID Connect, OAuth as needed).

Company Admin: Create Orgs, designate Org Admins.

Org Admin: Manage Teams, set point values, define levels, invite developers, manage ADO plugin settings.

General User UI (React-based):

SSO login.

Historical trends of individual user’s points (week, month, quarter, year).

Leaderboards across teams within an Org (cross-team comparisons).

Team-level overview: total points, number of badges per level, team composition.

Detailed view for a single team: each member’s points, highest earned badge, etc.

API: Exposes endpoints for plugin communication and potential future integrations.

Data Storage & Security

Secure data storage for user info, point tallies, badges, and historical logs.

Scalable Node.js backend to handle up to 10,000 companies.

Potential to incorporate additional compliance or security requirements later.

AI-Generated Code Recognition

Potentially track or detect AI-generated commits (e.g., code from GitHub Copilot or other AI tools).

Provide a specialized tag or point distribution rule for AI-assisted code.

User Capabilities

Company Admin:

Configure default point system for entire company.

Manage Orgs, designate Org Admins, authenticate ADO plugin.

View consolidated dashboards across all Orgs.

Org Admin:

Override default point values for this Org.

Create/edit teams, invite developers, assign roles.

Define up to 20 levels with threshold points and badges.

Manage advanced leaderboards and competitions.

Developer:

Earn points for activities in ADO.

See personal progress, badges, and trends over time.

General User:

Log in via SSO.

View team-level dashboards, leaderboards, and user stats.

Browse achievements (but not contribute code or gain points unless they are also a developer).

HOW – Planning & Implementation

3\. Technical Foundation

Required Stack Components

Frontend: React for Admin UI and General User UI.

Backend: Node.js (REST API architecture).

Database: Storing multi-tenant data (e.g., PostgreSQL or MongoDB).

SSO Integration: Support SAML, OAuth, or OpenID Connect for flexible company integration.

Azure DevOps Plugin: Securely authenticates to SaaS with token-based API calls.

Scalability: Horizontally scalable Node.js instances to support \~10,000 companies.

Security:

Encrypt sensitive data (e.g., tokens, user info).

Potential future compliance with SOC 2 or other standards.

System Requirements

Performance:

Near-real-time updates to reflect user points for each ADO activity.

Handle thousands of daily commits/PRs across multiple Orgs.

Reliability:

99.9% uptime target.

Storage:

Keep track of historical points data, at least 1 year’s worth, to enable trending.

AI Integration:

Potential for future enhancements to detect or flag AI-generated code commits.

4\. User Experience

Primary User Flows

Company & Org Setup

Entry: Company Admin registers company on CodeQuest → sets up SSO → configures default points.

Steps: Invite Org Admins → Org Admins create teams → Org Admins override point values if desired.

Success: All users can now log in via SSO and be assigned to teams.

Alternative: Adjust tier if the company needs more Orgs/Teams.

ADO Integration

Entry: Company Admin installs plugin from Azure Marketplace.

Steps: Authenticates plugin to SaaS → configures which ADO activities to track → sets up secure API tokens.

Success: Automated data flow from ADO to SaaS, awarding points in real time.

Alternative: Re-authentication needed if tokens expire or credentials change.

Team Gamification

Entry: Developer performs code checkin/PR/bug fix in ADO.

Steps: Data flows to SaaS → points assigned → user’s points total updated → check if new level is reached.

Success: Developer sees updated points and any earned badge in real time.

Alternative: If AI-generated code is detected, special tags or adjusted point logic may apply.

Dashboard & Leaderboards

Entry: General or Developer user logs in to see personal/team stats.

Steps: Access team summary → check overall points, badges, cross-team leaderboard.

Success: Clear visibility of standings; fosters friendly competition.

Alternative: If user belongs to multiple teams, user can toggle between teams’ stats.

5\. Business Requirements

Access Control

Super Admin (internal SaaS)

Company Admin

Org Admin

Developer

General Authenticated User (view-only)

Business Rules

Tiered Subscription for Orgs/Teams (Small, Medium, Enterprise).

Points & Levels: Maximum 20 levels per company. Default points can be overridden by Org Admin.

Data Validation: Basic checks on user data, team setups (minimum 1 Org Admin per Org).

Compliance: Potential to add higher-level compliance needs (e.g., SOC 2).

6\. Implementation Priorities

High Priority (Must Have)

Multi-tenant structure with tier-based limits (Orgs, Teams).

ADO plugin integration for real-time points awarding.

Role-based access control (Company Admin, Org Admin, Developer, General Viewer).

Points and Levels (up to 20).

React-based Admin UI and Node.js REST backend.

Basic leaderboards and historical trend data.

Medium Priority (Should Have)

AI code detection or tagging for special scoring.

Enhanced search and filtering across teams and users.

Advanced analytics dashboards for Org Admins and Company Admins.

Bulk onboarding for developers.

Lower Priority (Nice to Have)

CodeQuest mobile app or push notifications for level-up events.

Additional SSO customization features.

Advanced branding for each company.

Cross-company competition brackets or events.