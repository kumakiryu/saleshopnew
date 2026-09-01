# IMPORTANT

This is an enhancement stage.

Do NOT remove, replace, refactor, or rewrite any existing functionality.

Preserve all existing:

* Cart functionality
* Checkout functionality
* Orders system
* Admin Orders page
* Payment integrations
* PayMongo integration
* Coinbase integration
* Webhook handlers
* Email delivery system
* Stock deduction system
* Existing Supabase tables
* Existing routes
* Existing UI components

Only ADD the features described below.

If an existing implementation already exists, extend it rather than replacing it.

All current functionality must continue working exactly as it does now.

---

# Stage X+3 — Automatic Digital Code Delivery System

## Goal

Allow administrators to sell and automatically deliver digital codes after successful payment.

Examples:

* License Keys
* Activation Codes
* Gift Card Codes
* Voucher Codes
* Membership Keys
* Redeem Codes
* Access Tokens issued by the shop

Customers should receive their purchased code instantly through email after payment confirmation.

---

## Product Types

Add a new product type field:

* Physical Product
* Digital Download
* Digital Code

For Digital Code products, the system should deliver a code instead of a file.

---

## Supabase Database

### Product Codes Table

create table product_codes (
id uuid primary key default gen_random_uuid(),
product_id uuid references products(id),
code text not null,
status text default 'available',
assigned_to uuid,
assigned_at timestamp
);

### Status Values

* available
* reserved
* delivered

---

## Admin Dashboard

### New Section

Products
Orders
Announcements
Code Inventory
Customers
Settings

---

## Code Inventory Management

Admins can:

* Add codes individually
* Bulk import codes
* Delete unused codes
* View available stock
* View delivered codes

---

## Bulk Import

Allow admins to paste:

CODE-12345
CODE-67890
CODE-ABCDE

Each line becomes a new code entry.

---

## Automatic Delivery Flow

After successful payment:

1. Verify payment.
2. Reserve an available code.
3. Assign code to the order.
4. Mark code as delivered.
5. Send email automatically.
6. Reduce stock count.
7. Update order status.

---

## Customer Email

Subject:
Your Purchase Is Ready

Body:

Hello {customerName},

Thank you for your purchase.

Product:
{productName}

Your Code:

{assignedCode}

Order ID:
{orderId}

Please keep this code secure.

Thank you for your support.

---

## Order History

Customers should be able to view:

* Order ID
* Product Purchased
* Purchase Date
* Delivery Status
* Assigned Code

---

## Realtime Updates

Use Supabase Realtime.

When a code is delivered:

* Order status updates instantly.
* Admin dashboard updates instantly.
* Stock updates instantly.

No page refresh required.

---

## Security

* Never expose unassigned codes publicly.
* Assign one code only once.
* Prevent duplicate deliveries.
* Store codes securely in Supabase.
* Restrict code management to admins.

---

## Success Criteria

When a customer purchases a Digital Code product:

1. Payment succeeds.
2. A code is automatically assigned.
3. Stock decreases.
4. Email is sent instantly.
5. Order status becomes Delivered.
6. Admin sees the transaction immediately.
7. The customer receives the assigned code without manual intervention.
   Account Inventory Delivery (Optional Product Type)

   ### Supported Product Type

   Add another product type:

   * Physical Product
   * Digital Download
   * Digital Code
   * Account Product
     Account Products automatically assign a pre-created account from inventory after successful payment.

   ---

   ## Supabase Database

   ### Product Accounts Table

   create table product_accounts (
   id uuid primary key default gen_random_uuid(),
   product_id uuid references products(id),
   username text not null,
   password text not null,
   status text default 'available',
   assigned_order_id uuid,
   assigned_at timestamp,
   created_at timestamp default now()
   );

   ### Status Values

   * available
   * reserved
   * delivered

   ---

   ## Admin Dashboard

   Add a new management section:

   Code Inventory
   Account Inventory

   Admins can:

   * Add accounts
   * Edit accounts
   * Delete unused accounts
   * Bulk import accounts
   * View available inventory
   * View delivered inventory

   ---

   ## Bulk Account Import

   Allow admins to paste multiple account records.

   Example Format:

   [username1@example.com](mailto:username1@example.com) | Password123
   [username2@example.com](mailto:username2@example.com) | Password456
   [username3@example.com](mailto:username3@example.com) | Password789

   ## Each line should create a separate inventory entry.

   ## Inventory Statistics

   Display:

   * Total Accounts
   * Available Accounts
   * Delivered Accounts
   * Low Inventory Warning
     Example:
     Available Accounts: 12

   When inventory falls below a configurable threshold, show:

   ## Low Inventory Warning

   ## Automated Assignment Flow

   After payment succeeds:

   1. Verify payment.
   2. Locate an available account for the purchased product.
   3. Reserve the account.
   4. Create the order record.
   5. Assign the account to the order.
   6. Mark inventory as delivered.
   7. Update stock count.
   8. Send delivery email.
   9. Update order status to Delivered.

   ---

   ## Customer Email Template

   Subject:
   Your Account Details

   Body:

   Hello {customerName},

   Thank you for your purchase.

   Product:
   {productName}

   Account Details:

   Username:
   {assignedUsername}

   Password:
   {assignedPassword}

   Order ID:
   {orderId}

   Please store these details securely.

   ## Thank you for your support.

   ## Order Details Page

   Customers can view:

   * Order ID
   * Product Name
   * Purchase Date
   * Delivery Status
     If authorized:
   * Assigned Username
   * Assigned Password

   ---

   ## Realtime Synchronization

   Using Supabase Realtime:

   * Inventory updates instantly.
   * Stock updates instantly.
   * Order status updates instantly.
   * Admin dashboard updates instantly.
     No page refresh required.

   ---

   ## Security Requirements

   * Only admins can view inventory pools.
   * Never expose unassigned inventory publicly.
   * Each account may only be assigned once.
   * Prevent duplicate deliveries.
   * Restrict account management using Supabase RLS policies.
   * Log all inventory assignments for auditing.

   ---

   ## Success Criteria

   When a customer purchases an Account Product:

   1. Payment is verified.
   2. An available account is automatically assigned.
   3. Inventory count decreases.
   4. Order status updates.
   5. Customer receives account details by email.
   6. Admin dashboard reflects the delivery instantly.
   7. The assigned account cannot be delivered again.
