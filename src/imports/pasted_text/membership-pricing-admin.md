# Stage X+7 — Membership Pricing, Reseller System & Advanced Admin Dashboard

## IMPORTANT

This is an enhancement stage.

Do NOT remove, replace, refactor, or break any existing functionality.

Preserve all existing:

* Cart System
* Checkout System
* Orders
* Payment Providers
* PayMongo Integration
* Coinbase Integration
* Coins.ph Integration
* Webhooks
* Email Delivery
* Inventory Delivery
* Code Inventory
* Account Inventory
* Security Vault
* Announcements
* Admin Dashboard

Only ADD the features below.

---

# Goal

Upgrade the platform into a membership-based storefront with:

* Customer Accounts
* VIP Accounts
* Reseller Accounts
* Tier-Based Pricing
* Enhanced Admin Dashboard
* Resend Email Monitoring
* User Role Management

---

# Membership Tiers

Add customer tiers:

* Normal User
* VIP
* Reseller

Default:

New users = Normal User

---

## Tier Permissions

### Normal User

* Standard pricing
* Standard access

### VIP

* Discounted VIP pricing
* Access to VIP-only promotions
* Priority support

### Reseller

* Lowest reseller pricing
* Bulk purchasing support
* Access to reseller-only products
* Reseller badge

---

# Supabase Database

Create:

```sql id="x7a2jp"
create table user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tier text default 'normal',
  assigned_by uuid,
  assigned_at timestamp default now()
);
```

Valid values:

```text id="c63d3z"
normal
vip
reseller
```

---

# Product Pricing System

Extend products.

Each product should support:

```text id="xjymkn"
Regular Price
VIP Price
Reseller Price
```

Example:

Regular Price: ₱299
VIP Price: ₱249
Reseller Price: ₱199

---

# Product Page

Automatically detect user tier.

Display:

For Normal Users:

```text id="zohv1q"
Price: ₱299
```

For VIP:

```text id="r8r5dl"
VIP Price: ₱249
You Save ₱50
```

For Resellers:

```text id="4j34d4"
Reseller Price: ₱199
You Save ₱100
```

---

# Pricing Logic

Checkout must automatically use:

Normal User → Regular Price

VIP → VIP Price

Reseller → Reseller Price

Do not allow client-side price manipulation.

All pricing calculations must be validated server-side.

---

# VIP & Reseller Login

Add dedicated routes:

```text id="i87f7l"
/vip
/reseller
```

Purpose:

Landing pages for each membership type.

Features:

* Login
* Membership Benefits
* Tier Information
* Upgrade Instructions

---

# Membership Badges

Display:

VIP

or

RESELLER

beside usernames.

Examples:

```text id="3h6v5n"
Denniel [VIP]

John [RESELLER]
```

---

# Admin Dashboard Revamp

Completely modernize the dashboard UI.

Maintain functionality.

Improve:

* Layout
* Navigation
* Responsiveness
* Visual hierarchy
* Analytics visibility

Use:

* Glassmorphism
* Modern cards
* Better charts
* Improved tables
* Faster workflows

---

# New Dashboard Overview

Display:

Total Orders

Today's Revenue

Monthly Revenue

Pending Orders

Delivered Orders

Available Inventory

VIP Users

Reseller Users

Email Success Rate

---

# Membership Management

Create new admin section:

Members

Admins can:

* View users
* Promote to VIP
* Promote to Reseller
* Remove VIP
* Remove Reseller
* Search users
* Filter by membership

---

# VIP / Reseller Analytics

Display:

VIP Revenue

Reseller Revenue

Orders by Tier

Top Resellers

Most Purchased Products

---

# Resend Email Monitoring

Integrate Resend tracking into Admin Dashboard.

Admins should no longer need to visit Resend.

Create:

Email Center

---

## Email Center Features

Display:

* Delivered Emails
* Failed Emails
* Pending Emails
* Bounce Events
* Last Sent Timestamp

---

## Email Logs

For each email:

Show:

Recipient

Subject

Status

Provider Response

Sent Time

Delivery Time

Order ID

---

## Status Badges

Delivered

Failed

Queued

Processing

Bounced

---

## Order Integration

Inside every order:

Show:

Email Status

Example:

```text id="trk7lu"
Order #1234

Email Status:
Delivered

Sent:
September 4, 2026
```

---

# Real-Time Email Monitoring

Using Supabase Realtime:

When an email changes status:

* Dashboard updates instantly
* Order page updates instantly
* Email Center updates instantly

No page refresh required.

---

# Membership Pricing Preview

On product cards:

Display:

Regular Price

VIP Price

Reseller Price

Example:

```text id="hd91df"
Regular: ₱299

VIP: ₱249

Reseller: ₱199
```

Users should clearly see membership benefits.

---

# Security

Only admins may:

* Change memberships
* View email logs
* Access Email Center

All membership updates should be recorded in audit logs.

---

# Success Criteria

1. Products support 3 pricing tiers.
2. VIP users receive VIP pricing automatically.
3. Resellers receive reseller pricing automatically.
4. Checkout uses correct tier pricing.
5. Admins can manage memberships.
6. Dashboard UI is significantly improved.
7. Resend email statuses appear inside Admin Dashboard.
8. Email delivery monitoring works in real time.
9. Existing payment and delivery systems remain fully operational.
