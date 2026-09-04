# Fix the Existing PayMongo Payment + Order Confirmation Flow

Do NOT redesign the website and do NOT replace the existing PayMongo integration.

Work with the payment/webhook implementation that already exists.

The PayMongo webhook is configured and the `PAYMONGO_WEBHOOK_SECRET` is already set correctly. All required environment variables are already configured.

The current test behavior is:

1. Customer creates an order.
2. Customer reaches the Order Confirmation / Order Status page.
3. Customer clicks Pay Now.
4. PayMongo opens in a new tab.
5. Customer successfully completes payment in PayMongo.
6. Payment succeeds.
7. BUT the original Order Confirmation page does not update.
8. The product is not automatically delivered.
9. The order remains stuck instead of changing to paid/completed.
10. The customer is not reliably returned to / synchronized with the original order status page.

The goal is to fix the actual existing flow, not create a fake frontend simulation.

---

## REQUIRED USER EXPERIENCE

The customer should remain anchored to:

`/order-status/{orderId}`

The Order Status page is the main page for the entire order lifecycle.

When the customer clicks **Pay Now**, PayMongo may open in a separate tab/window because the payment provider requires its own checkout experience.

However, after payment:

**The customer must NOT be sent to `/api/paymongo-webhook`.**

`/api/paymongo-webhook` is a SERVER endpoint only. It must never become the customer's browser destination.

The webhook should run in the background on Vercel.

The customer-facing page remains:

`/order-status/{orderId}`

---

# 1. Correct the PayMongo Redirect Behavior

Inspect the current CheckoutPage and OrderStatusPage implementation.

Do NOT navigate the browser to:

`/api/paymongo-webhook`

The webhook endpoint must only receive PayMongo server-to-server requests.

The customer-facing return URL configured when creating the PayMongo checkout/payment must point to the existing order status page.

Use the actual order ID:

`/order-status/{orderId}`

The success/cancel state can be communicated through query parameters if needed, for example:

`/order-status/{orderId}?payment=success`

or:

`/order-status/{orderId}?payment=cancelled`

But these query parameters are only UI hints.

The frontend must NEVER trust the query parameter as proof of payment.

---

# 2. Keep the Order Status Page as the Source of Truth for the Customer

When the order status page opens, it should load the current order state from the backend.

It should NOT depend solely on:

* React state
* localStorage
* the PayMongo redirect URL
* a `payment=success` query parameter
* a frontend timer

The page must ask the backend for the current order/payment/delivery status.

For example:

`GET /api/orders/{orderId}`

or use the project's existing order-status endpoint.

Use whichever API already exists in the project rather than creating unnecessary duplicate APIs.

---

# 3. Automatically Synchronize After Payment

The customer may finish payment in another tab.

The original Order Status page must continue checking the order.

Use the project's existing realtime infrastructure if available.

Otherwise use polling.

Polling behavior:

* Begin polling while payment is pending.
* Poll approximately every 3 seconds.
* Stop unnecessary polling once the order reaches a terminal state.
* Clean up timers/subscriptions when the component unmounts.

The flow should be:

```text
Order Status Page
        ↓
Payment Pending
        ↓
PayMongo checkout opened
        ↓
Customer pays
        ↓
PayMongo sends webhook to backend
        ↓
Backend verifies webhook
        ↓
Backend updates order
        ↓
Backend fulfills order
        ↓
Order Status Page detects updated state
        ↓
UI changes automatically
        ↓
Product appears
```

The browser does NOT need to receive the webhook directly.

---

# 4. Fix the Webhook → Fulfillment Chain

This is the most important part.

The PayMongo webhook is already configured.

Trace exactly what happens after a successful PayMongo event.

The expected server-side flow is:

```text
PayMongo webhook
      ↓
Verify webhook authenticity
      ↓
Identify payment
      ↓
Identify order
      ↓
Confirm payment is successful
      ↓
Update order/payment status
      ↓
Call fulfillOrder(orderId)
      ↓
Reserve inventory
      ↓
Attach product to order
      ↓
Mark inventory as sold
      ↓
Mark delivery as completed
      ↓
Return successful webhook response
```

Do NOT stop after marking the payment as paid.

A successful payment must trigger fulfillment.

---

# 5. Fix Order ID Resolution

The previous implementation attempted multiple methods of extracting the UUID.

Keep that fallback logic, but make the order identification deterministic.

When creating the PayMongo payment/checkout session, make sure the order ID is stored in metadata or another server-side field that can be reliably retrieved from the webhook.

Preferred structure:

```text
PayMongo payment/session
        ↓
metadata
        ↓
orderId
```

The webhook should retrieve the exact order ID from the webhook event.

Do not depend exclusively on parsing human-readable descriptions.

Description parsing can remain as a fallback, but metadata should be the primary source.

If the webhook cannot identify an order, log this clearly and DO NOT mark an unrelated order as paid.

---

# 6. Make Fulfillment Idempotent

A webhook can potentially be delivered more than once.

Before delivering a product, check whether that order has already been fulfilled.

Example:

```text
if order.delivery_status === "completed":
    log duplicate webhook
    return success
```

If fulfillment is still processing, do not allocate another product.

The same order must never receive multiple inventory codes because of duplicate webhook events.

---

# 7. Inventory Delivery Must Be Transaction-Safe

When payment is verified:

1. Find available inventory for the purchased product.
2. Reserve one item.
3. Attach it to the order.
4. Mark it as sold/used.
5. Store the delivered product on the order.
6. Mark delivery complete.

Make sure concurrent webhook executions cannot select the same inventory item.

If the project is using Supabase, use the project's existing server-side/service-role access where appropriate.

Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

---

# 8. Do Not Fail Silently

This was one of the main problems in the previous test.

Every stage must produce useful server logs.

Add structured logs around the complete flow:

```text
[PAYMONGO_WEBHOOK]
Event received

[PAYMONGO_WEBHOOK]
Payment ID: ...

[PAYMONGO_WEBHOOK]
Order ID: ...

[PAYMONGO_WEBHOOK]
Payment status: ...

[PAYMONGO_WEBHOOK]
Order found: true/false

[FULFILLMENT]
Starting fulfillment for order ...

[FULFILLMENT]
Inventory search started

[FULFILLMENT]
Inventory item selected: ...

[FULFILLMENT]
Product attached to order

[FULFILLMENT]
Inventory marked sold

[FULFILLMENT]
Order marked completed

[FULFILLMENT]
SUCCESS
```

On failures:

```text
[FULFILLMENT]
FAILED

Order ID: ...
Payment ID: ...
Stage: inventory allocation
Error: ...
```

Never use empty catch blocks.

Never swallow errors.

---

# 9. Important: Distinguish Payment From Delivery

The system should have separate states.

For example:

```text
payment_status:
pending
paid
failed
cancelled
expired

delivery_status:
pending
processing
completed
failed

order_status:
pending
paid
processing
completed
cancelled
```

This prevents a delivery failure from incorrectly appearing as a payment failure.

Example:

```text
Payment
✓ Paid

Delivery
⚠ Processing
```

instead of:

```text
Payment Failed
```

---

# 10. Update Order Status Page Automatically

The Order Status page should react to backend changes.

Example progression:

```text
Awaiting Payment
      ↓
Payment Received
      ↓
Processing Order
      ↓
Product Delivered
      ↓
Order Completed
```

Do not require manual refresh.

When the backend changes the order to paid:

```text
Payment
✓ Confirmed
```

When fulfillment begins:

```text
Delivery
⏳ Preparing your product...
```

When fulfillment succeeds:

```text
Delivery
✓ Product Delivered
```

Then display the actual purchased product/code directly on the same Order Status page.

---

# 11. Product Must Appear on the Existing Page

After successful fulfillment, reload/refetch the order data.

The page should display the delivered product without requiring the customer to navigate elsewhere.

Example:

```text
Order #12345

✓ Payment Confirmed
✓ Product Delivered

Your Product

XXXX-XXXX-XXXX-XXXX

[Copy]
```

Use the actual product associated with the order.

Do not generate fake codes.

Do not display placeholder inventory.

---

# 12. PayMongo Success/Cancel Handling

When the customer returns from PayMongo:

```text
/order-status/{orderId}?payment=success
```

show:

```text
Payment Received
Verifying your payment...
```

But immediately continue checking the backend.

Do NOT mark the order as paid just because:

`payment=success`

is present.

The backend's verified payment state remains authoritative.

Likewise:

```text
?payment=cancelled
```

should only affect the customer-facing message and should not overwrite a genuinely successful payment that has already been confirmed server-side.

---

# 13. Do Not Redirect to the Webhook

This is critical.

Search the entire codebase for any code similar to:

```javascript
window.location.href = "/api/paymongo-webhook..."
```

or:

```javascript
location.href = webhookUrl
```

or:

```javascript
router.push("/api/paymongo-webhook")
```

or anything that uses the webhook endpoint as a browser redirect.

Remove/fix it.

The webhook URL is NEVER a customer redirect URL.

Customer:

```text
/order-status/{orderId}
```

PayMongo backend notification:

```text
/api/paymongo-webhook
```

These are completely separate flows.

---

# 14. Preserve the Existing PayMongo New-Tab Flow

Keep the current behavior where clicking Pay Now opens PayMongo separately.

This is acceptable and preferable because the user can pay without losing the Order Status page.

The original page should remain available underneath.

Example:

```text
TAB 1:
Order Status
/order-status/123

TAB 2:
PayMongo checkout
```

After payment, TAB 1 is still the customer's order-status page.

The page automatically detects that the payment/order has changed.

Do NOT force the customer to manually find the original page again.

---

# 15. Make the Payment Button State-Aware

On the Order Status page:

Before payment:

```text
[Pay Now]
```

While payment is being processed:

```text
Payment verification in progress...
```

After confirmed payment:

```text
✓ Paid
```

Once fulfilled:

```text
✓ Order Completed
```

Do not continue showing Pay Now after confirmed payment.

---

# 16. Protect Against Race Conditions

Handle this sequence correctly:

```text
Webhook arrives
        ↓
Order gets marked PAID
        ↓
Frontend polls at same moment
```

The frontend should simply read the latest state.

Likewise:

```text
Webhook arrives twice
```

must not result in two product deliveries.

And:

```text
Customer refreshes
```

must not reset payment/delivery state.

The database remains the source of truth.

---

# 17. Check the Existing APIs Before Creating New Ones

Before writing new endpoints, inspect:

* existing payment creation API
* existing PayMongo webhook API
* existing fulfillment function
* existing order API
* existing OrderStatusPage
* existing CheckoutPage
* existing Supabase queries
* existing inventory logic

Fix the current implementation wherever possible.

Do not create duplicate payment systems or duplicate fulfillment systems.

---

# 18. Acceptance Test

The implementation is only considered fixed when this exact test works:

```text
1. Create order
2. Open Order Status page
3. Click Pay Now
4. PayMongo opens in a new tab
5. Complete successful payment
6. PayMongo sends webhook to /api/paymongo-webhook
7. Webhook is verified
8. Correct order ID is found
9. Order becomes paid
10. fulfillOrder() runs
11. Inventory is allocated
12. Product is attached to order
13. Delivery becomes completed
14. Order Status page automatically detects the updated order
15. UI changes from pending → paid → delivered
16. Product appears on the SAME Order Status page
```

Also test:

```text
Customer closes PayMongo tab after payment
Customer refreshes Order Status
Duplicate webhook
No inventory available
Invalid webhook
Fulfillment error
Already fulfilled order
Cancelled payment
Failed payment
```

---

# FINAL REQUIREMENT

Do not solve this by merely changing text on the frontend.

The real success condition is:

**A successful PayMongo payment must cause the backend webhook to successfully identify the correct order, fulfill the product, update the database, and cause the existing Order Status page to automatically reflect the new state without redirecting the customer to the webhook URL.**

The webhook is backend-only.

The Order Status page is customer-facing.

Keep those two flows completely separate.
