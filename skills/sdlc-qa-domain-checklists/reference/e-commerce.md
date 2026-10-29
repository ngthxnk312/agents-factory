# E-commerce checklist

Scope: catalog, search and browse, product detail, cart, pricing and promotions, checkout, payment, inventory, orders, fulfilment and shipping, returns and refunds, customer accounts, marketplace sellers. Use with `cross-cutting.md` and, for payment handling, `payments-fintech.md`.

## State dimensions

Customer (guest, registered, logged in, loyalty tier, blocked); product (in stock, low stock, out of stock, pre-order, discontinued, variant combinations, digital vs physical, age-restricted); cart (empty, single, many items, mixed sellers, saved for later, expired); promotion (active, scheduled, expired, exhausted, stackable/non-stackable); order (placed, paid, partially shipped, shipped, delivered, cancelled, returned, refunded); region (currency, tax rules, shipping zones, language).

## Checklist

### Catalog and search

- Variants (size/color) select correct SKU, price, stock and images
- Search relevance basics, typos, synonyms, filters (pairwise combinations), sort by price/newest/rating with ties, pagination, no-result state with suggestions
- Prices and availability consistent between list, detail, cart and checkout

### Cart

- Add/remove/update quantity; max quantity per item and per order (max, max+1); quantity 0 and negative rejected
- [C] Price or stock changed after adding to cart → user informed before payment
- Cart persistence across devices/sessions; guest cart merged on login without duplicates
- Mixed sellers/shipping methods split correctly

### Pricing, tax, promotions

- [C] Rounding per currency; tax per region and product category; tax-inclusive vs exclusive display
- [C] Coupons: valid, expired, not-yet-active, usage limit per user and global, minimum basket at boundary, exclusions, stacking rules, applied once only (double submit)
- Free-shipping thresholds at boundary; bundles; tiered discounts; loyalty points earn/burn and reversal on return

### Checkout

- Address validation, saved addresses, shipping method availability per zone, delivery date estimates
- [C] Final amount = items + shipping + tax − discounts, identical on review page, payment request and order record
- [C] Double click on "Place order" creates one order; browser back after payment does not resubmit
- Session timeout during checkout; inventory reservation expiry
- Guest checkout vs account creation; terms acceptance captured

### Payment

- [C] Each method (card, wallet, bank transfer, buy-now-pay-later, cash on delivery): success, decline, timeout, 3-D Secure/step-up challenge success/failure/abandon, duplicate callback
- [C] Payment success but order creation failure (and the reverse) → consistent outcome and automatic refund/compensation
- Saved payment methods tokenized; no full card data stored or logged

### Inventory and orders

- [C] Concurrent purchase of the last item → no oversell beyond the configured policy
- Order status transitions and notifications; partial shipment; cancellation windows; order history accuracy
- Seller/merchant views and fulfilment updates (marketplaces)

### Returns and refunds

- Eligibility windows at boundary; partial returns; refund to original method; promotions and loyalty recalculated
- [C] Refund amount equals paid amount for returned items including proportional discounts; refund once only

### Accounts and privacy

- Registration, email verification, password reset, social login linking; order lookup for guests
- [C] Other customers' orders/addresses inaccessible by id manipulation
- Marketing consent and preferences honored

### Performance and peak events

- Catalog and checkout response under peak load (sale events); queueing/waiting room behavior; graceful degradation of recommendations

## Common defects

Price shown differs from charged; coupon applied twice; oversold last item; refund ignoring proportional discount; tax wrong for a region; guest cart merge duplicates; order created without successful payment.

## Automation notes

Candidates: price/tax/promotion calculation matrices via API, cart and checkout happy paths with sandbox payments, coupon rule sets, order state transitions. Partial/manual: 3-D Secure challenges on real issuer pages, real courier integrations, visual merchandising checks.
