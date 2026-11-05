
# PROJECT: APNACITY
## Hyperlocal Multi-Vendor E-Commerce Marketplace

Act as a Principal Software Architect, Senior Full-Stack Engineer,
Database Architect and DevOps Engineer.

Your responsibility is to design and develop a production-ready
hyperlocal multi-vendor e-commerce marketplace called ApnaCity.

The business model is similar to Amazon, but the main focus is
local shops, city-wise product discovery, price comparison,
individual shop websites and local delivery.

IMPORTANT:
Do not create a simple demo or a static frontend.
Build a scalable, secure, modular and maintainable application.

================================================
1. BUSINESS REQUIREMENTS
================================================

Central marketplace:
https://apnacity.com

City websites:
https://bijnor.apnacity.com
https://moradabad.apnacity.com

Individual shop websites:
https://bagga-cloth.bijnor.apnacity.com
https://electronics.bijnor.apnacity.com

Every shopkeeper must have an individual online storefront.

Every product added by a shopkeeper must automatically
become available on:
1. The shop's individual website.
2. The central ApnaCity marketplace.
3. The relevant city product search.
4. Customer mobile applications.

A shopkeeper should only need to upload a product once.

The platform must support multiple states, cities,
localities, pincodes and shops.

================================================
2. TECHNOLOGY STACK
================================================

Frontend:
- Next.js
- TypeScript
- React
- Tailwind CSS
- Responsive design
- PWA support

Backend:
- NestJS
- TypeScript
- REST APIs
- Swagger/OpenAPI
- Modular monolith architecture

Database:
- PostgreSQL
- PostGIS
- Prisma ORM
- Redis
- BullMQ

Search:
- OpenSearch

Storage:
- S3-compatible object storage
- Image compression and optimisation
- CDN

Mobile:
- React Native
- Expo
- TypeScript

Infrastructure:
- Docker
- Docker Compose for local development
- CI/CD
- Environment-based configuration
- Structured logging
- OpenTelemetry

================================================
3. MULTI-TENANT ARCHITECTURE
================================================

Implement a shared multi-tenant architecture.

Every shop must have:
- Unique shop ID.
- Unique seller ID.
- Unique shop slug.
- City ID.
- Tenant configuration.
- Individual storefront.
- Shop-specific branding.
- Shop-specific product listings.
- Shop-specific inventory.
- Shop-specific orders and reports.

Resolve shop identity using the incoming hostname.

Example:
bagga-cloth.bijnor.apnacity.com

The system must resolve the hostname to the correct
shop and load its storefront automatically.

Implement:
- Wildcard DNS routing.
- Wildcard TLS/custom-hostname strategy.
- Tenant resolution middleware.
- Tenant-level authorization.
- Tenant data isolation.
- Shop domain management.

Never create separate application deployments or
databases for individual shops.

Prevent all cross-tenant data access.

================================================
4. USER ROLES
================================================

Implement role-based access control.

Roles:

1. SUPER_ADMIN
2. CITY_ADMIN
3. SELLER_OWNER
4. SELLER_STAFF
5. CUSTOMER
6. DELIVERY_PARTNER
7. CUSTOMER_SUPPORT

Each role must have clearly defined permissions.

A seller must only access their own shop,
products, inventory, orders and financial information.

================================================
5. CORE BUSINESS MODULES
================================================

Create separate backend modules for:

1. Authentication and authorization.
2. Geography and city management.
3. Seller onboarding and KYC.
4. Shop and tenant management.
5. Shop domain management.
6. Product catalogue.
7. Product variants.
8. Seller product listings.
9. Inventory management.
10. Product image management.
11. Search and discovery.
12. Shopping cart.
13. Checkout.
14. Order management.
15. Payment management.
16. Seller commission.
17. Financial ledger.
18. Seller settlements.
19. Delivery management.
20. Delivery partner management.
21. Returns and refunds.
22. Customer reviews.
23. Promotions and coupons.
24. Notifications.
25. Customer support.
26. Analytics and reporting.
27. Admin management.
28. Audit logging.

Each module must have its own service,
controller, DTOs, validation and tests.

Keep business logic out of controllers.

================================================
6. PRODUCT CATALOGUE DESIGN
================================================

IMPORTANT:

Separate master products from seller listings.

Master product:
- Product ID.
- Name.
- Brand.
- Category.
- Description.
- Attributes.
- Images.
- Barcode or GTIN where available.

Seller listing:
- Listing ID.
- Product ID.
- Seller ID.
- Shop ID.
- Selling price.
- MRP.
- Tax information.
- SKU.
- Availability.
- Listing status.

Product variants:
- Size.
- Colour.
- Material.
- Weight.
- Other category-specific attributes.

A single master product may have listings from
multiple shops with different prices and inventory.

Do not duplicate the master product every time
another shop sells the same item.

Implement product matching and duplicate detection.

================================================
7. SELLER PORTAL
================================================

Create a highly user-friendly seller dashboard.

Menu:

- Dashboard
- My Products
- Add Product
- Inventory
- Orders
- My Shop
- Shop Website
- Delivery
- Payments
- Commission
- Offers
- Reviews
- Reports
- Settings

Product upload must support:

1. Mobile camera.
2. Multiple product images.
3. Image compression.
4. Product name.
5. Product description.
6. Category selection.
7. Brand.
8. Product variants.
9. Price and MRP.
10. SKU and barcode.
11. Stock quantity.
12. Tax information.
13. Product weight.
14. Delivery details.

Support bulk CSV/Excel product imports.

Allow shopkeepers to update inventory and prices
quickly from mobile devices.

Support Hindi and English.

Allow AI-assisted product descriptions and
category suggestions as an optional feature.

================================================
8. CUSTOMER MARKETPLACE
================================================

Homepage:
- State selection.
- City selection.
- Location/pincode selection.
- Product search.
- Categories.
- Featured shops.
- Popular local products.
- Offers.
- Recommended products.

Search:
- Search by product name.
- Search by brand.
- Search by category.
- Search by seller.
- Search by barcode where available.

Filters:
- Price range.
- Brand.
- Colour.
- Size.
- Shop.
- Availability.
- Distance.
- Delivery time.
- Ratings.

Sorting:
- Price low to high.
- Price high to low.
- Nearest shop.
- Fastest delivery.
- Highest rating.

Display:
- Product image.
- Product name.
- Shop name.
- Shop location.
- Selling price.
- MRP.
- Stock availability.
- Delivery estimate.
- Seller rating.

Search results must be restricted to the
customer's selected city and serviceable area.

================================================
9. ORDER MANAGEMENT
================================================

Implement parent order and seller child orders.

One customer checkout can contain products
from multiple shops.

Create:
- One parent customer order.
- Separate seller orders.
- Separate seller fulfilment workflows.
- Separate shipments/delivery jobs where needed.

Support:
- Order creation.
- Seller notification.
- Seller acceptance/rejection.
- Stock reservation.
- Order preparation.
- Dispatch.
- Delivery.
- Cancellation.
- Partial cancellation.
- Returns.
- Exchanges.
- Refunds.

Implement a validated order state machine.

Maintain a complete order event history.

Use idempotency keys to prevent duplicate orders
and duplicate payment processing.

================================================
10. PAYMENT AND FINANCE
================================================

Create a payment provider abstraction.

Evaluate:
- Cashfree Payments.
- Razorpay.

Support:
- UPI.
- Cards.
- Net banking.
- Cash on delivery.
- Refunds.
- Seller commission.
- Seller settlements.
- Payment reconciliation.

Implement a double-entry financial ledger.

Maintain separate seller balances.

Never calculate financial balances only
from order statuses.

Verify payment webhooks and prevent replay attacks.

Do not store sensitive card credentials.

================================================
11. DELIVERY MANAGEMENT
================================================

Support three delivery methods:

A. ApnaCity delivery partners.
B. Seller's own delivery.
C. External logistics providers.

Prepare provider adapters for:
- Shadowfax.
- Shiprocket.
- Other future providers.

Delivery workflow:
- Serviceability check.
- Delivery fee calculation.
- Rider assignment.
- Pickup.
- In transit.
- Out for delivery.
- Delivery OTP.
- Proof of delivery.
- Failed delivery.
- Return pickup.

Implement a delivery partner application
using React Native and Expo.

================================================
12. INDIVIDUAL SHOP WEBSITE
================================================

Automatically generate the shop website.

The shopkeeper must be able to configure:

- Shop logo.
- Shop banner.
- Shop name.
- Description.
- Contact information.
- Shop address.
- Opening hours.
- Product categories.
- Featured products.
- Offers.
- Delivery policies.

Generate the storefront using the same shared
Next.js application.

Each shop website must have its own:
- SEO title.
- Meta description.
- Canonical URLs.
- Product pages.
- Structured data where appropriate.

================================================
13. MOBILE APPLICATIONS
================================================

Develop four applications/interfaces:

1. Customer application.
2. Seller application.
3. Delivery partner application.
4. Admin web portal.

Use React Native and Expo for customer,
seller and delivery mobile applications.

All mobile applications must use the same
backend APIs and business rules as the web platform.

Support:
- Android.
- iOS.
- Push notifications.
- Camera.
- GPS.
- Image uploads.
- Order tracking.

================================================
14. DATABASE REQUIREMENTS
================================================

Create a proper relational database schema.

Core tables must include:

users
roles
permissions
customer_profiles
addresses
states
cities
localities
pincodes
sellers
shops
shop_domains
shop_settings
categories
brands
products
product_variants
seller_listings
listing_variants
inventory_locations
inventory
stock_movements
stock_reservations
carts
cart_items
orders
seller_orders
order_items
order_events
payments
payment_transactions
refunds
ledger_accounts
ledger_entries
commissions
settlements
delivery_partners
delivery_jobs
shipments
tracking_events
coupons
reviews
notifications
support_tickets
audit_logs
webhook_events

Use proper:
- Foreign keys.
- Indexes.
- Unique constraints.
- Transactions.
- Database migrations.
- Tenant isolation.
- Audit history.

Use PostGIS for location queries.

================================================
15. SECURITY AND QUALITY
================================================

Implement:
- Secure authentication.
- RBAC.
- Tenant isolation.
- API validation.
- Rate limiting.
- Secure image upload.
- Payment webhook verification.
- Audit logging.
- Secret management.
- Data encryption.
- Error handling.
- Automated backups.

Testing:
- Unit tests.
- Integration tests.
- API tests.
- Tenant isolation tests.
- Order lifecycle tests.
- Inventory concurrency tests.
- Payment reconciliation tests.
- Mobile application tests.

================================================
16. DEVELOPMENT PROCESS
================================================

DO NOT attempt to implement everything in one step.

First produce:

1. System architecture document.
2. Database ER diagram.
3. Complete module breakdown.
4. API specification.
5. Project folder structure.
6. Development roadmap.
7. Security architecture.
8. Local development environment.

Then implement in phases:

PHASE 1:
- Project foundation.
- Authentication.
- Geography.
- Seller onboarding.
- Multi-tenancy.
- Shop domain resolution.

PHASE 2:
- Product catalogue.
- Seller portal.
- Inventory.
- Individual shop storefronts.

PHASE 3:
- Central marketplace.
- Search.
- Price comparison.
- Cart and checkout.

PHASE 4:
- Orders.
- Payments.
- Seller commission.
- Financial ledger.

PHASE 5:
- Delivery management.
- Returns.
- Notifications.

PHASE 6:
- Customer mobile app.
- Seller mobile app.
- Delivery mobile app.

PHASE 7:
- Advanced analytics.
- AI capabilities.
- Performance optimisation.
- Production deployment.

After each phase:
- Run tests.
- Fix issues.
- Update documentation.
- Verify integration with previous phases.
- Commit the working code.

Do not leave fake APIs, non-functional buttons,
placeholder payment flows or hardcoded business data.

Use environment variables for all credentials.

Deliver a fully working, tested application
with deployment documentation.

================================================
END OF MASTER REQUIREMENTS
================================================




17. Recommended project folder structure
I would ask Claude Code to use a monorepo so that all applications and backend modules can be maintained together.
apnacity/
│
├── apps/
│   ├── marketplace-web/
│   ├── seller-portal/
│   ├── admin-portal/
│   ├── customer-mobile/
│   ├── seller-mobile/
│   ├── delivery-mobile/
│   └── api/
│
├── packages/
│   ├── ui/
│   ├── shared-types/
│   ├── api-client/
│   ├── validation/
│   ├── auth/
│   ├── config/
│   └── utilities/
│
├── infrastructure/
│   ├── docker/
│   ├── database/
│   ├── redis/
│   ├── opensearch/
│   ├── monitoring/
│   └── deployment/
│
├── documentation/
│   ├── architecture/
│   ├── database/
│   ├── api/
│   ├── security/
│   ├── deployment/
│   └── business-requirements/
│
├── scripts/
├── tests/
├── .env.example
├── docker-compose.yml
└── README.md

18. My final recommendations before starting
There are five decisions I would make before asking Claude Code to start implementing the project.
Decision	My recommendation
Initial launch	Bijnor, Uttar Pradesh
Business model	Multi-vendor marketplace
Architecture	Multi-tenant modular monolith
Mobile technology	React Native + Expo
Initial seller experience	Responsive web portal + PWA

Five things I would not compromise on
1. Seller simplicity: A shopkeeper should be able to upload a product in less than a minute once registered.
2. One-time product upload: Products should automatically appear on the individual shop website and central marketplace.
3. Accurate inventory: No overselling, even when multiple customers order simultaneously.
4. Financial transparency: Every shopkeeper must have a clear order-wise commission and payment statement.
5. City-wise expansion: Adding a new city should be a configuration and onboarding activity, not a new software development project.
A few important questions about the business model
These decisions will affect the database, checkout, delivery and financial architecture. I would like to establish them before finalising the detailed development specification.
ApnaCity – Business decisions
1. Who will handle local delivery?

ApnaCity will have its own delivery partners.

Shopkeepers will deliver themselves.

Both options, depending on the shop.

Third-party delivery companies only.


2. Should customers buy from multiple shops in one checkout?

Yes – one cart and one checkout for multiple shops.

No – one shop per order.


3. Who can become a seller?

Any local shopkeeper after verification.

Only GST-registered businesses.

Only sellers approved by the city administrator.


4. Which products should the platform support?

All categories (clothing, electronics, groceries, etc.).

General retail products initially.

Fashion, clothing and footwear initially.


5. Where do you want to establish the business?

India-based company, operating in India.

German company operating in India.

Not decided yet.

Submit decisions