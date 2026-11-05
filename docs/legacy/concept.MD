I want to build a ecommerce platform: it is exectly like amazon. . The main thing is I want to use by the city wise and each city local shopkeppers. which means, the user login to the apanacity.com - then he will select he state, city and it will show the products lists like amazon from that area: people can search the product. after selecting it can show the price from low to high and the location with shop infromation as seller. the most important part is the backend system for shopkeeper. it should be so smooth that shopkeper can easily upload the products and picture and additional details and customers can also easily see on the mobile to use shoping. in addition everyshopkeeper wil have its store or shop website. that means he will add his produc on his shop website and those producs will be available on the main site automatical. - example I have shop bagga-cloth in bijnor. so the domain would be bagga-cloth.bijnor.apnacity.com and so on : please provide the modules that need to be develped for such platform, including the delivery, order receiving and this should be compatible for IOS and Android. Do deep search and provide the details so that I can share with my claude code to develop

ApnaCity – Hyperlocal E-commerce Marketplace Platform
Platform architecture and development blueprint
 Multi-vendor marketplace


Your idea is to build something like Amazon, but with a much stronger focus on local shops, city-wise product discovery, and local delivery.

I would position ApnaCity as a Hyperlocal Multi-Vendor E-commerce Marketplace.

The most important architectural decision is that ApnaCity should not be developed as just one e-commerce website. It should be a complete marketplace ecosystem consisting of:
1. A central marketplace – apnacity.com
2. Individual shop websites – bagga-cloth.bijnor.apnacity.com
3. A shopkeeper management portal – where sellers manage their complete business.
4. A customer mobile experience – Android and iOS.
5. A delivery management system – for local delivery partners.
6. A central administration platform – to manage cities, shops, orders, payments, commissions and operations.
My recommendation: Build one central backend with a multi-tenant architecture. Every shop should have its own online storefront, but all shops should use the same product, inventory, order and payment infrastructure.

This means a shopkeeper uploads a product once, and it automatically becomes available on:
- Their own shop website.
- The ApnaCity central marketplace.
- The relevant city and category search results.
- The Android and iOS applications.
You should not develop separate e-commerce backends for every shop.
1. How the ApnaCity ecosystem should work
ApnaCity
Central Marketplace

apnacity.com

Search · Discover · Compare · Order

Shared platform services and APIs

Shop A

Bagga Cloth

bagga-cloth.bijnor.apnacity.com
Bijnor


Shop B

Local Electronics

electronics.bijnor.apnacity.com
Bijnor


Shop C

Fashion Store

fashion.moradabad.apnacity.com
Moradabad


Shop D

Mobile Store

mobiles.bijnor.apnacity.com
Bijnor




Shared platform infrastructure
Product catalogue


Inventory engine


Order management


Payment engine


Delivery engine


Search engine


Customer accounts


Seller management


Notifications


Analytics & reports




Customer + Seller + Delivery Apps
Web · Android · iOS


Example customer journey
A customer opens apnacity.com.
1. Selects India → Uttar Pradesh → Bijnor.
2. Enters a product search, for example, Nike shoes.
3. ApnaCity searches all registered sellers in Bijnor.
4. Results show the product from different shops.
5. The customer sorts by lowest price, highest rating, nearest shop or fastest delivery.
6. The customer opens the product and sees shop details, images, stock, delivery estimate and price.
7. Adds the product to the cart and places an order.
8. The shopkeeper receives an order notification.
9. The shopkeeper accepts and prepares the product.
10. A delivery partner collects and delivers it.
11. The customer tracks the delivery and confirms receipt.
The customer can also visit bagga-cloth.bijnor.apnacity.com directly and shop only from Bagga Cloth.

One important detail: a product should be a shared catalogue entry, while each shop has its own seller-specific listing, price, stock and delivery settings. This is what allows the same product to appear across multiple shops without duplicating the underlying catalogue.
2. Complete modules to be developed
I recommend dividing the development into 15 major modules. Each module should have its own clear responsibilities and APIs.









Module 1 – Central Marketplace
Customer-facing
- Homepage and featured products
- State, city and locality selection
- Product search and filters
- Price comparison across shops
- Product details and seller information
- Shopping cart and checkout
- Customer reviews and ratings












Module 2 – Seller Management Portal
Most important module
- Shopkeeper registration and verification
- Shop profile and business information
- Product upload and editing
- Multiple image uploads
- Bulk Excel/CSV product upload
- Inventory and stock management
- Price and discount management
- Order acceptance and rejection
- Sales reports and settlements












Module 3 – Individual Shop Website Builder
- Automatic shop subdomain
- Individual shop homepage
- Shop logo, banner and branding
- Shop-specific categories
- Shop-specific product search
- Product pages and reviews
- Contact, address and opening hours
- Store policies and delivery information
The shopkeeper should not need technical knowledge to create a website.












Module 4 – Delivery Management
- Local delivery partner registration
- Automatic delivery assignment
- Manual delivery assignment
- Pickup and delivery tracking
- Delivery OTP verification
- Proof of delivery
- Delivery charges and distance calculation
- Failed delivery management
- Return pickup and reverse logistics












Module 5 – Order Management System (OMS)
- Customer order creation
- Seller order notification
- Seller acceptance/rejection
- Order splitting between different shops
- Order cancellation
- Partial cancellation
- Order fulfilment and dispatch
- Refund and return processing
- Complete order history and audit trail












Module 6 – Payment and Settlement
- UPI payments
- Debit and credit cards
- Net banking
- Cash on delivery
- Refunds
- Seller commission calculation
- Seller payout management
- Platform revenue reports
- Payment reconciliation
- GST and settlement reports












Module 7 – Product Catalogue and Inventory
- Central product catalogue
- Seller-specific product listings
- Product categories and subcategories
- SKU and barcode support
- Product sizes, colours and variants
- Stock quantity and availability
- Multiple shop locations
- Low-stock notifications
- Out-of-stock handling
- Price history












Module 8 – Search and Product Discovery
- Search by product name
- Search by brand and category
- Search across all shops in a city
- Price low-to-high / high-to-low
- Distance-based search
- Shop rating and product rating
- Availability and delivery filters
- Typo tolerance and suggestions
- Recently searched products












Module 9 – Central Admin Dashboard
- Manage states, cities and localities
- Approve and suspend shops
- Manage customers and sellers
- Manage product categories
- Manage commissions
- Monitor orders and delivery
- Manage disputes and complaints
- Platform revenue and analytics
- Configure promotions
- Manage platform-wide settings












Module 10 – Notifications and Communication
- Push notifications
- SMS notifications
- WhatsApp notifications
- Email notifications
- New order alerts
- Order status updates
- Delivery notifications
- Seller/customer messaging
- Support ticket notifications












Module 11 – Offers, Coupons and Loyalty
- Shop-specific coupons
- City-specific promotions
- Platform-wide offers
- Referral programme
- Customer reward points
- Cashback and promotional credits
- Sponsored product placements
- Festival and seasonal campaigns












Module 12 – Delivery Partner Application
- Rider registration and KYC
- Availability toggle
- Assigned deliveries
- Pickup and drop navigation
- Customer contact
- OTP and delivery confirmation
- Daily earnings
- Delivery history
- Return pickup workflow












Module 13 – Customer Account and Experience
- Mobile OTP login
- Customer profile
- Multiple delivery addresses
- Wishlist
- Saved shops
- Order tracking
- Return and refund requests
- Reviews and ratings
- Notifications and preferences












Module 14 – Customer and Seller Support
- Customer complaints
- Seller support tickets
- Order-related disputes
- Refund escalation
- Return disputes
- Admin resolution workflow
- FAQ and help centre












Module 15 – Analytics and Business Intelligence
- City-wise sales
- Shop-wise sales
- Product performance
- Most searched products
- Customer behaviour
- Order conversion rates
- Seller performance
- Delivery performance
- Revenue and commission reports



3. The most important part: Shopkeeper experience
I would give this module the highest development priority.

Your biggest challenge will not be creating the customer website. It will be making the platform so simple that a local shopkeeper with limited technical knowledge can start selling without needing assistance.

For example, a shopkeeper should be able to register, add 20 products, and start receiving orders within 15–30 minutes.
Seller dashboard design




















12













The seller dashboard should have the following menu structure:
Menu	Functions
Dashboard	Sales, orders, revenue, notifications
My Products	Add, edit, delete and publish
Inventory	Stock, variants, availability
Orders	New, accepted, processing, completed
My Shop	Logo, banner, website and details
Delivery	Delivery options, charges, pickup
Payments	Earnings, commission, payouts
Offers	Discounts and coupons
Reviews	Customer ratings and feedback
Reports	Sales and product performance
Settings	GST, bank, profile and preferences

Product upload workflow
The product upload experience should be designed as a simple wizard.
Add a new product
Example: Bagga Cloth – Bijnor
Step 1 – Upload product pictures









Take pictures using the mobile camera or select existing photos. Support multiple pictures.


Step 2 – Product information

Example product details
- Product name: Men's Cotton Shirt
- Category: Men's Clothing
- Brand: Local Brand
- Description: Cotton casual shirt
- Sizes: M, L, XL, XXL
- Colours: Blue, Black, White


Step 3 – Pricing and inventory
- Selling price: ₹799
- MRP: ₹1,199
- Available stock: 25
- SKU: BGC-SH-001


Step 4 – Delivery information
- Product weight
- Package dimensions
- Pickup location
- Local delivery availability


Step 5 – Publish

Automatic

The product is published on Bagga Cloth's website and appears in Bijnor marketplace search results.

Features I strongly recommend for the seller portal:
- Camera-based product upload.
- Automatic image compression and resizing.
- AI-assisted product title and description generation.
- Automatic category suggestions.
- Bulk product upload using Excel.
- Duplicate product detection.
- Copy an existing product to create a new variant.
- Quick stock updates.
- Pause/resume product visibility.
- Mobile-friendly seller portal.
Also support Hindi and English from the beginning. Many local shopkeepers will be more comfortable managing their products in Hindi.
4. Shop website and subdomain architecture
Your domain structure is a very good idea. I would retain it.
Website	Purpose
apnacity.com	Central marketplace
www.apnacity.com	Main customer website
bijnor.apnacity.com	Bijnor city landing page
bagga-cloth.bijnor.apnacity.com	Bagga Cloth shop
electronics.bijnor.apnacity.com	Electronics shop
fashion.moradabad.apnacity.com	Fashion shop

How automatic shop creation should work
When a shopkeeper registers:
1. Enters shop name.
2. Selects state and city.
3. Enters shop address and contact information.
4. Uploads shop logo and banner.
5. Selects product categories.
6. Completes business verification.
7. Clicks Create My Shop.
The backend automatically creates the shop's tenant record and website address.

For example:
Shop name: Bagga Cloth
City: Bijnor
Shop slug: bagga-cloth

Generated website:
https://bagga-cloth.bijnor.apnacity.com


Technical implementation
Use a multi-tenant website architecture.
- Wildcard DNS records route shop subdomains to the same application.
- A wildcard TLS certificate is required for each city-level namespace, such as *.bijnor.apnacity.com, or use a managed custom-hostname certificate service.
- The application identifies the shop using the incoming hostname.
- The backend fetches the shop configuration, branding, products and settings using its tenant ID.
- No separate application deployment is required for individual shops.
Next.js has an official multi-tenant architecture guide demonstrating how one application can serve multiple tenants. 
Next.js

Example of automatic request routing
Customer opens:
bagga-cloth.bijnor.apnacity.com
               |
               v
       DNS / CDN / Proxy
               |
               v
        Next.js Application
               |
               v
      Extract hostname
               |
               v
      Find shop by domain
               |
               v
       tenant_id = 1025
               |
               v
       Load shop configuration
               |
               v
       Display Bagga Cloth



Important: Do not create a new database for each shop. Use one shared database with strict tenant isolation. Every seller-owned record must be associated with a tenant_id or seller_id. A seller must never be able to access another seller's products, orders, customer details or financial information.
5. Product catalogue – how Amazon-like price comparison should work
This is one of the most important business features.

You should distinguish between two concepts:
- Master product: The actual product, such as Nike Air Max shoes.
- Seller listing: A particular shop's offer for that product.
For example, three shops in Bijnor sell the same product.









Nike Air Max Shoes

Example product comparison
Available in Bijnor



Bagga Cloth

1.2 km · In stock

₹3,499



City Sports

2.5 km · In stock

₹3,299
Lowest price



Fashion Hub

0.8 km · In stock

₹3,699



When the customer searches, ApnaCity should:
1. Find matching master products.
2. Find active seller listings for those products.
3. Filter listings by selected city and delivery serviceability.
4. Check available inventory.
5. Calculate delivery charges.
6. Calculate estimated delivery time.
7. Sort by the selected criteria.
Search and sorting options
Sorting	Behaviour
Price: Low to High	Lowest selling price first
Price: High to Low	Highest selling price first
Nearest Shop	Shortest geographical distance
Fastest Delivery	Shortest delivery ETA
Highest Rated	Highest seller/product rating
Best Value	Price, quality and delivery combination

An important consideration: compare the same product and variant, not merely similar product names. A size 8 shoe should not be compared with a size 10 shoe.

For products without a shared barcode or manufacturer identifier, provide a product-matching and duplicate-detection workflow.
Recommended search engine
Use OpenSearch for product discovery.

It supports:
- Full-text search.
- Autocomplete.
- Product category filters.
- Brand, colour and size filters.
- Price range filters.
- Geo-distance sorting.
These are established e-commerce search capabilities documented by OpenSearch. 
OpenSearch Documentation+1

6. Order management – complete order lifecycle
Your platform needs a proper Order Management System (OMS).

This is especially important when customers buy products from multiple shops in one checkout.
Example: Customer orders from three shops
A customer adds:
- Shirt from Bagga Cloth – ₹799
- Shoes from City Sports – ₹2,499
- Watch from Time Gallery – ₹1,499
The customer places one order for ₹4,797 before delivery charges and applicable taxes.

However, internally the system creates:
Parent Order
₹4,797
APN-2026-000123


Bagga Cloth
₹799
Seller Order 001
Preparing


City Sports
₹2,499
Seller Order 002
Ready


Time Gallery
₹1,499
Seller Order 003
Accepted



Each seller receives only their own order items. The customer sees one consolidated order with individual shipment tracking.

This is called parent-order and child-order architecture.
Order status lifecycle
1. Order placed
   
   Customer completes checkout.
2. Payment confirmed
   
   Payment gateway confirms payment or COD is selected.
3. Seller notified
   
   Seller receives an instant notification.
4. Seller accepts order
   
   Seller confirms product availability.
5. Order preparation
   
   Product is packed and marked ready.
6. Delivery assigned
   
   Delivery partner is allocated.
7. Picked up
   
   Delivery partner collects the product.
8. Out for delivery
   
   Customer receives tracking information.
9. Delivered
   
   OTP or other proof of delivery is recorded.
10. Completed
    
    Seller settlement and commission reconciliation take place.

You must also support:
- Seller rejection due to unavailable stock.
- Customer cancellation.
- Seller cancellation.
- Partial order fulfilment.
- Partial refunds.
- Returns and exchanges.
- Failed delivery.
- Cash-on-delivery reconciliation.
- Disputes and complaints.
Do not allow arbitrary order-status updates. Implement a validated state machine with role-based permissions and an immutable order-event history.
7. Delivery management – local and external delivery
I recommend developing a delivery engine that supports three delivery methods.









Option A – ApnaCity local delivery

Recruit local delivery partners in each city. The platform assigns deliveries based on location, availability, distance and workload.












Option B – Shopkeeper delivery

The shopkeeper delivers the product using their own staff or vehicle. They update delivery status from the seller portal.












Option C – Third-party logistics

Integrate delivery providers for longer distances, intercity deliveries, returns and locations where ApnaCity has no local riders.



Delivery integrations worth investigating
Provider	Potential use
Shadowfax	Local and hyperlocal delivery
Shiprocket	Shipping, tracking and returns
Porter	Local goods movement
ApnaCity Riders	Your own delivery network

Useful developer references:
- Shadowfax API documentation
- Shiprocket API documentation
Shadowfax documents forward delivery, reverse pickup, exchange and hyperlocal marketplace workflows. Shiprocket exposes order, shipment, tracking and return APIs. 
developer.shadowfax.in+1

Delivery assignment algorithm
For a local order, the system should:
1. Identify the shop pickup location.
2. Identify the customer's delivery coordinates.
3. Calculate distance and serviceability.
4. Find available riders in the service area.
5. Estimate pickup and delivery time.
6. Assign the best eligible rider.
7. Notify the seller, rider and customer.
Do not simply assign the nearest rider. Consider current workload, vehicle type, delivery capacity and estimated arrival time.
Delivery partner application
The rider application should have four main screens:
- Available deliveries.
- Assigned deliveries.
- Active delivery with navigation.
- Earnings and delivery history.
It should support Android and iOS, GPS location sharing during active deliveries, OTP confirmation, proof of delivery and offline status updates where connectivity is poor.
8. Payment gateway and seller settlement
This is another area where you should design the backend carefully from the beginning.

ApnaCity should collect payment from the customer and maintain separate financial records for each seller.
Recommended payment provider
Investigate these providers:
- Cashfree Payments – Easy Split.
- Razorpay – Marketplace payment and linked-account capabilities.
Cashfree Easy Split, for example, supports vendor registration, order-level splits, vendor settlements, refunds and reconciliation. 
Cashfree


Official documentation: Cashfree Easy Split
Example financial calculation
Suppose Bagga Cloth sells a shirt for ₹1,000.
Item	Amount
Product selling price	₹1,000
ApnaCity commission (example 5%)	₹50
Seller's gross payable amount	₹950

The system should separately record:
- Product selling price.
- Applicable taxes.
- Platform commission.
- Payment gateway fees.
- Delivery fees.
- Refunds.
- TCS and other applicable deductions.
- Seller payable balance.
The example above is illustrative, not a complete GST settlement calculation.
Financial modules
1. Customer payment collection.
2. Seller account and bank verification.
3. Commission configuration.
4. Payment splitting.
5. Seller settlement.
6. Refund management.
7. Cash-on-delivery reconciliation.
8. Payment gateway reconciliation.
9. Seller ledger.
10. Platform revenue ledger.
Very important: Never calculate seller balances only from the current order status. Implement a proper double-entry financial ledger with immutable entries, settlement references and reconciliation. This prevents serious financial discrepancies later.

9. Android and iOS applications
I recommend building four user experiences, but they do not all need to be released at the same time.









1. Customer App
Android + iOS
- Browse and search products
- Compare local prices
- Place orders
- Track delivery
- Wishlist and offers












2. Seller App
Android + iOS
- Upload products using camera
- Manage inventory
- Receive orders
- Accept and reject orders
- View sales and payments












3. Delivery App
Android + iOS
- Receive delivery assignments
- Navigate to shops and customers
- Update delivery status
- Verify delivery OTP
- Track earnings












4. Admin Portal
Web application
- Manage the complete platform
- Approve sellers
- Monitor orders
- Manage payments and disputes
- Analyse business performance



Technology for mobile applications
My recommendation is React Native + Expo + TypeScript.

Reasons:
- One shared codebase for Android and iOS.
- Camera and image uploads.
- Push notifications.
- GPS and location services.
- Barcode scanning.
- App Store and Google Play deployment.
- Shared API and authentication logic.
Expo provides a framework for universal applications across Android, iOS and web. 
Expo documentation+1


For the seller experience, I would also create a Progressive Web App (PWA). A shopkeeper can open it directly from Chrome, install it on the home screen and manage the shop without first installing a mobile application.

This is particularly useful when onboarding thousands of small retailers.

10. Recommended technical architecture
I would not start with 15 separate microservices. That would make initial development, testing and maintenance unnecessarily complicated.

Start with a modular monolith with clearly separated business modules, and allow individual modules to become independent services when traffic and operational requirements justify it.
Recommended technology stack
Layer	Recommended technology	Purpose
Customer website	Next.js + TypeScript	SEO-friendly marketplace
Shop websites	Next.js multi-tenant	Individual shop storefronts
Seller portal	Next.js	Seller operations
Admin portal	Next.js	Central administration
Mobile applications	React Native + Expo	Android and iOS
Backend	NestJS + TypeScript	Business logic and APIs
Database	PostgreSQL	Main transactional database
Geo-location	PostGIS	Shop/customer location queries
ORM	Prisma	Database access and migrations
Cache	Redis	Sessions, cache and temporary data
Background jobs	BullMQ + Redis	Notifications, imports, workflows
Search	OpenSearch	Product search and filtering
File storage	S3-compatible object storage	Product images and documents
CDN	Cloudflare or equivalent	Fast image and website delivery
Authentication	JWT + refresh tokens / OTP	Secure user access
Notifications	FCM + APNs	Push notifications
Monitoring	OpenTelemetry + Grafana	Application monitoring
Deployment	Docker + CI/CD	Build and release management

High-level architecture
Presentation layer

Marketplace · Storefronts · Seller portal · Admin · Mobile apps · Rider app


API Gateway / Backend for Frontend

Authentication · Rate limiting · Request validation · Tenant resolution


NestJS modular backend
User & identity


City & location


Seller & tenant


Product catalogue


Inventory


Search


Cart & checkout


Order management


Payment & ledger


Delivery & logistics


Reviews & offers


Notifications


Reports & analytics


Support & compliance





PostgreSQL

Transactional data + PostGIS


Redis

Cache + jobs


OpenSearch

Search index


Object Storage

Images + files




External integrations

Payment gateways · SMS · WhatsApp · Logistics · Maps · Email · ONDC


Backend module boundaries
Each module should have its own:
- Controllers and API endpoints.
- Services and business rules.
- Database entities/repositories.
- DTOs and validation.
- Authorization policies.
- Unit and integration tests.
- Events published to other modules.
For example, the Order module should not directly modify the Payment module's database tables. It should communicate through defined interfaces and events.

Use transactional outbox patterns for important events such as order placement, payment confirmation and seller notification. This prevents lost notifications when background workers or external services fail.
11. Database architecture – the foundation of ApnaCity
This is the database design I would give particular attention to before coding.
Core database entities
Domain	Main entities
Geography	countries, states, cities, localities, pincodes
Users	users, customer_profiles, addresses, roles
Tenants	sellers, shops, shop_domains, shop_settings
Catalogue	products, categories, brands, attributes, variants
Listings	seller_listings, listing_variants, prices
Inventory	inventory_locations, stock, stock_movements, reservations
Orders	orders, seller_orders, order_items, order_events
Payments	payments, payment_transactions, refunds
Finance	ledger_accounts, ledger_entries, commissions, settlements
Delivery	delivery_partners, delivery_jobs, shipments, tracking_events
Promotions	coupons, campaigns, discounts
Customer	reviews, wishlists, carts, cart_items
Support	tickets, disputes, return_requests
System	notifications, audit_logs, webhook_events

Example database relationship
#chatgpt-mermaid-_r_mo_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_mo_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_mo_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_mo_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-_r_mo_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-_r_mo_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_mo_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_mo_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_mo_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_mo_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_mo_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_mo_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_mo_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_mo_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_mo_ p{margin:0;}#chatgpt-mermaid-_r_mo_ .entityBox{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_mo_ .relationshipLabelBox{fill:rgb(243, 243, 243);opacity:0.7;background-color:rgb(243, 243, 243);}#chatgpt-mermaid-_r_mo_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-_r_mo_ .labelBkg{background-color:rgba(243, 243, 243, 0.5);}#chatgpt-mermaid-_r_mo_ .edgeLabel{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-_r_mo_ .edgeLabel .label rect{fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_mo_ .edgeLabel .label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_mo_ .edgeLabel .label{fill:rgb(83, 154, 248);font-size:14px;}#chatgpt-mermaid-_r_mo_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_mo_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-_r_mo_ .node rect,#chatgpt-mermaid-_r_mo_ .node circle,#chatgpt-mermaid-_r_mo_ .node ellipse,#chatgpt-mermaid-_r_mo_ .node polygon{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-_r_mo_ .relationshipLine{stroke:rgb(143, 143, 143);stroke-width:1px;fill:none;}#chatgpt-mermaid-_r_mo_ .marker{fill:none!important;stroke:rgb(143, 143, 143)!important;stroke-width:1;}#chatgpt-mermaid-_r_mo_ [data-look=neo].labelBkg{background-color:rgba(243, 243, 243, 0.5);}#chatgpt-mermaid-_r_mo_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_mo_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_mo_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_mo_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_mo_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_mo_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_mo_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_mo_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_mo_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_mo_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-_r_mo_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_mo_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_mo_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_mo_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_mo_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_mo_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_mo_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_mo_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}CITYSHOPSELLERSHOP_DOMAINSELLER_LISTINGPRODUCTINVENTORYPRODUCT_VARIANTLISTING_VARIANTCUSTOMERORDERSELLER_ORDERORDER_ITEMDELIVERY_JOBPAYMENTSETTLEMENTcontainsownshaspublisheslisted_ashascontainsoffered_asplacessplits_intocontainsfulfilled_bypaid_byreceives





Critical design rules
1. Product master data must be independent of seller listings.
2. Each seller listing must belong to a shop.
3. Each inventory record must identify its shop and stock location.
4. Each order must preserve the product name, SKU, price and tax details at purchase time.
5. Order records must not depend on the current product listing to display historical orders.
6. Financial transactions must be immutable.
7. Every tenant-specific API must enforce tenant isolation.
8. Inventory reservations must be atomic to prevent overselling.
9. Use UUID identifiers internally and human-readable order numbers externally.
10. All dates should be stored in UTC and displayed in the appropriate local timezone.
Inventory example
Suppose Bagga Cloth has 25 shirts.
- Customer A orders 2.
- Customer B orders 3.
- Customer C tries to order 22.
The inventory engine must prevent the third order if only 20 units remain after the first two reservations.

Use database transactions and row-level locking or atomic conditional stock updates. Redis cache alone must never be the authority for stock availability.

12. Important additional capabilities
These features may not be necessary for the first release, but the architecture should allow them.
Capability	Business benefit
AI product descriptions	Shopkeepers upload products faster
AI image enhancement	Better product presentation
Hindi voice-assisted upload	Local retailers can add products by speaking
WhatsApp ordering	Customers can order without installing an app
Barcode scanning	Faster inventory management
Shop QR code	Customers visit a shop's online store directly
ONDC integration	Potential access to an interoperable commerce network
Local advertising	Shops promote products within their city
Business insights	Shops understand customer demand
B2B wholesale	Retailers can purchase from wholesalers
Subscription plans	Recurring revenue from sellers

ONDC – a future opportunity
I would keep the backend ready for ONDC integration.

ONDC's Seller Network Participants connect sellers, digitise product catalogues and facilitate payments. Its Buyer Network Participants provide customer-facing shopping applications. 
ONDC Network+1


This could eventually provide another distribution channel for ApnaCity's registered shops. However, treat ONDC as a separate integration project, not a prerequisite for your first release.
13. Security, compliance and Indian business requirements
Because ApnaCity will handle customer information, shopkeeper information, payments and financial settlements, these requirements should be included in the initial architecture.
Legal and regulatory checklist
Area	What ApnaCity needs
Company	Appropriate Indian business entity and marketplace structure
GST	E-commerce operator registration and applicable tax compliance
Seller KYC	Seller identity, business details, PAN and applicable GST information
Payments	RBI-compliant payment gateway and settlement arrangements
Consumer protection	Seller disclosures, transparent pricing, grievance handling and refund policies
Data protection	DPDP Act and Rules compliance
Privacy	Privacy policy, consent notices and data retention controls
Security	Secure authentication, encryption and access control
Accounting	Seller-wise financial records and reconciliation
Product compliance	Category-specific rules for regulated products

Some important official references:
1. Consumer Protection (E-Commerce) Rules, 2020 – marketplace and seller responsibilities. The government announced further amendments in September 2026, with the amended rules scheduled to come into force on 1 January 2027. Design the compliance module to support these requirements too. 
   consumeraffairs.gov.in+1
2. CBIC GST FAQs – e-commerce operator registration and TCS requirements. The precise treatment depends on the transaction and payment arrangement, so obtain professional GST advice before enabling seller payouts. 
   cbic-gst.gov.in+1
3. Ministry of Electronics and Information Technology – DPDP Act and Rules. The DPDP Rules, 2025 have been notified with phased implementation requirements. 
   pib.gov.in
4. Reserve Bank of India – applicable payment aggregator regulations.
One additional business consideration: if you intend to raise foreign investment, structure the platform as a genuine marketplace and obtain legal advice on the applicable FDI conditions. Marketplace and inventory-based e-commerce have different restrictions. 
DPIIT+1

Security requirements for developers
- Role-based access control (RBAC).
- Tenant-level data isolation.
- Secure OTP authentication.
- Password hashing using a modern password-hashing algorithm.
- Short-lived access tokens and refresh-token rotation.
- API rate limiting.
- Payment webhook signature verification.
- Protection against duplicate payment and order requests.
- Audit trails for seller and admin actions.
- Encrypted sensitive information.
- Secure image/document upload validation.
- Backup and disaster recovery.
- Monitoring and security alerts.
- No hardcoded API keys, passwords or secrets.
Never store card details or UPI credentials yourself. Use the payment provider's secure checkout and tokenisation facilities.

14. Development roadmap – how I would actually build this
My recommendation is to launch in one city first, preferably Bijnor, and then expand city by city.

Don't attempt to build the complete Amazon feature set in the first release.
Phase 1 – Core marketplace MVP
First release
Objective: Make local shops sell products online.
- Multi-city and shop data model.
- Customer registration.
- State/city selection.
- Product catalogue.
- Seller registration.
- Seller dashboard.
- Product upload with images.
- Individual shop websites.
- Central marketplace.
- Product search and price comparison.
- Cart and checkout.
- Basic order management.
- Admin dashboard.
- Online payment and COD configuration.
Deliverable: A fully working Bijnor marketplace with individual shop websites.

Phase 2 – Delivery and operations
Operational release
Objective: Complete the local shopping experience.
- Delivery partner registration.
- Rider application.
- Delivery assignment.
- Delivery tracking.
- OTP confirmation.
- Return and refund processing.
- Seller settlement.
- Customer notifications.
- Reviews and ratings.
- Shop-level analytics.
  
  Phase 3 – Android and iOS
  Objective: Expand mobile usage.
- Customer Android application.
- Customer iOS application.
- Seller Android/iOS application.
- Delivery partner Android/iOS application.
- Push notifications.
- Location services.
- Mobile camera product upload.
- Mobile order tracking.
  
  Phase 4 – Advanced marketplace
  Objective: Scale the platform.
- AI-assisted catalogue management.
- Advanced product matching.
- Advanced search.
- City-wise advertisements.
- Loyalty and referral programmes.
- Automated delivery optimisation.
- ONDC integration.
- Wholesale marketplace.
- Multi-language experience.
- Advanced business intelligence.
- Additional cities and regional expansion.

Development priority
Priority	Component
P0	Tenant architecture, authentication, database
P0	Seller onboarding and product upload
P0	Shop websites and central marketplace
P0	Inventory and product search
P0	Cart, checkout and orders
P0	Admin portal
P1	Payment settlement and delivery
P1	Customer/seller mobile applications
P1	Returns and customer support
P2	AI, advertising, loyalty and ONDC

For the first pilot, aim to onboard 20–50 shops and a manageable selection of products. Measure product upload success, order acceptance, stock accuracy, fulfilment time and repeat purchases before opening additional cities.
15. Business model – how ApnaCity can generate revenue
I would not depend on only one revenue source.
Revenue stream	Example
Order commission	2–8% per successful order
Seller subscription	Monthly premium shop plans
Featured products	Paid product visibility
Featured shops	Promoted city-level stores
Delivery fee	Customer or seller delivery charges
Advertising	Local sponsored advertisements
Premium website	Customised shop branding and features
Business analytics	Advanced seller reports

For initial onboarding, you could offer free shop registration and a limited introductory commission to attract local retailers.

For example, if ApnaCity processes 1,000 successful orders per day with an average order value of ₹700 and earns an average 5% commission:
Illustrative daily platform commission
₹35,000

Daily order value

₹7,00,000

Daily orders

1,000

Monthly commission (30 days)

₹10,50,000

Illustrative gross commission revenue before GST, refunds, payment fees, delivery costs, marketing, support and operating expenses. Not a business forecast.


16. Master development instructions for Claude Code
This is the part I would give Claude Code.

I strongly recommend that you do not ask Claude to generate the entire application in one go. Give it the following architecture and development rules, then implement one phase at a time.

The following is a reusable master prompt.


