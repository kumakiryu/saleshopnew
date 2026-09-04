Stage X+8 — VIP & Reseller Token Economy System

IMPORTANT

This is an enhancement stage.



Do NOT modify or break existing:



Membership System

VIP Pricing

Reseller Pricing

Cart

Checkout

Orders

Payments

Inventory

Email Delivery

Dashboard

Announcements



Only ADD the token system.

Goal

Create a loyalty and rewards system for:



VIP Members

Reseller Members



Users earn tokens through:



Purchases

Top-Ups

Admin Rewards



Tokens can be redeemed for exclusive products.

Token Types

Create:

VIP Tokens
Reseller Tokens


VIP and Reseller balances are separate.



Normal users cannot participate.

Database

Create:

create table user_tokens (
  user_id uuid primary key,
  vip_tokens integer default 0,
  reseller_tokens integer default 0,
  updated_at timestamp default now()
);


Token Transactions

Create:

create table token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  transaction_type text,
  amount integer,
  reason text,
  created_at timestamp default now()
);


Examples:



Purchase Reward



Token Redemption



Admin Bonus



Top-Up



Adjustment

Earning Tokens

Purchase Rewards

VIP:

₱100 spent = 1 VIP Token


Reseller:

₱100 spent = 2 Reseller Tokens


Award automatically after successful payment.

Token Top-Up

Add:

/vip/topup
/reseller/topup


Users can buy token packages.



Example:



50 Tokens
100 Tokens
250 Tokens
500 Tokens



Use existing payment providers.

Membership Dashboard

Create:

/vip/dashboard
/reseller/dashboard


Display:



Current Balance



Lifetime Earned



Lifetime Spent



Rank



Leaderboard Position



Recent Transactions

Leaderboards

Create:

/vip/leaderboard
/reseller/leaderboard


Display:



Top 10 Token Holders

VIP Leaderboard

Example:

#1 Denniel - 2,500 VIP Tokens
#2 John - 2,100 VIP Tokens
#3 Sarah - 1,980 VIP Tokens


Reseller Leaderboard

Example:

#1 ResellerKing - 10,000 Tokens
#2 ShopMaster - 8,400 Tokens


Dynamic Rankings

Leaderboard must update automatically.



If a user:



Earns tokens

Tops up

Redeems tokens



their ranking changes immediately.



The leaderboard should always reflect CURRENT token balance.



Not lifetime earnings.

Redeem Store

Create:

/vip/rewards
/reseller/rewards


Visibility Rules

VIP Rewards:



Visible only to VIP members.



Reseller Rewards:



Visible only to Reseller members.



Normal users cannot view reward products.

Reward Products

Create product type:

Token Reward Product


Fields:



Name



Description



Image



Token Cost



Membership Type



Inventory

Redemption Flow

User clicks:



Redeem



System:



Checks balance.

Checks inventory.

Deducts tokens.

Creates redemption order.

Delivers item.

Updates leaderboard.

Example

Before:

Denniel
500 Tokens
Rank #2


Redeems:

Premium Account
Cost: 100 Tokens


After:

Denniel
400 Tokens
Rank #4


Leaderboard updates automatically.

Admin Dashboard

Add:



Token Economy



under:



Members
Email Center
Token Economy
Settings

Admin Controls

Admins can:



Add Tokens

Remove Tokens

Reset Balances

Create Rewards

Disable Rewards

View Transactions

View Top Holders

Dashboard Analytics

Display:



Total VIP Tokens



Total Reseller Tokens



Tokens Issued



Tokens Redeemed



Top Holders



Most Redeemed Reward

Realtime Updates

Using Supabase Realtime:



Update instantly when:



Purchase completed

Top-Up completed

Reward redeemed

Admin adjustment made



No page refresh required.

Anti-Abuse Protection

Prevent:



Negative balances

Duplicate redemptions

Token duplication

Multiple reward claims from same transaction



All token operations must be server-side validated.

Header Account Menu

Convert the current account badge:



[VIP] user@email.com

[RESELLER] user@email.com

into a fully interactive account button.



The entire component should be clickable.

Account Dropdown Menu

When clicked:



━━━━━━━━━━━━━━
👤 My Account
📦 Order History
🪙 Token Wallet
🏆 Leaderboard
🎁 Rewards Store
⚙ Settings
🚪 Logout
━━━━━━━━━━━━━━

Use:



 Glassmorphism styling 

 Smooth animations 

 Hover effects 

 Mobile-friendly design 

VIP Dashboard

Create:



/vip/dashboard

Display:

Profile Card

VIP Badge



Email Address



Member Since



Current Rank



Leaderboard Position

Token Wallet

Display:



Current Tokens: 250

Lifetime Earned: 750

Lifetime Spent: 500

Quick Stats

Display:



Current Rank
Current Balance
Total Orders
Total Amount Spent

Recent Transactions

Display:



+5 Tokens - Purchase Reward

+100 Tokens - Token Top-Up

-25 Tokens - Reward Redemption

Order History

Display:



Order ID



Product Name



Order Total



Purchase Date



Status



Example:



#ORD-001

Premium Account

₱299

Delivered

Dashboard Shortcuts

Display:



🏆 View Leaderboard

🎁 Redeem Rewards

🪙 Top Up Tokens

Reseller Dashboard

Create:



/reseller/dashboard

Display:

Profile Card

Reseller Badge



Email Address



Member Since



Current Rank



Leaderboard Position

Token Wallet

Display:



Current Tokens: 1,250

Lifetime Earned: 3,000

Lifetime Spent: 1,750

Quick Stats

Display:



Current Rank
Current Balance
Total Orders
Total Amount Spent

Order History

Display:



 Purchased Products 

 Redemption Orders 

 Token Top-Ups 

Dashboard Shortcuts

Display:



🏆 View Leaderboard

🎁 Redeem Rewards

🪙 Top Up Tokens

Header Token Display

When logged in, display token balance beside account badge.



VIP Example:



[VIP] user@email.com

🪙 250

Reseller Example:



[RESELLER] user@email.com

🪙 1250

Update instantly using Supabase Realtime.

Mobile Experience

On mobile:



Clicking:



[VIP] user@email.com

or



[RESELLER] user@email.com

opens a bottom-sheet menu instead of a desktop dropdown.

Realtime Updates

Update instantly when:



 Tokens are earned 

 Tokens are redeemed 

 Token top-up succeeds 

 Orders are delivered 

 Rank changes 

 Leaderboard changes 



No page refresh required.

User Experience Goal

The VIP and Reseller systems should feel like a premium membership portal.



Users should be able to:



 View token balance immediately. 

 Access order history in one click. 

 View leaderboard position. 

 Redeem rewards. 

 Top up tokens. 

 Track transactions. 

 Manage membership from a single dashboard. 

Success Criteria

VIP and Reseller users accumulate tokens.

Purchases award tokens automatically.

Token top-ups work through existing payments.

Leaderboards show Top 10 holders.

Rankings update in real time.

Redeeming rewards reduces balances.

Leaderboards reflect current balances.

VIP rewards are visible only to VIP members.

Reseller rewards are visible only to Reseller members.

Existing storefront functionality remains unchanged.