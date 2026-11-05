# ApnaCity Wireframes — all surfaces (text wireframes; implement per guide PART IV)

## 1. Marketplace Home (apnacity.com, city selected)
```
┌──────────────────────────────────────────────────────────┐
│ 🛍 ApnaCity  [🔍 Search products, brands, shops…] EN|HI 👤 │
│ Location: 📍 Bijnor, UP ▾                    Cart (3)     │
├──────────────────────────────────────────────────────────┤
│ [All][Fashion][Electronics][Grocery][Mobiles][Home] →     │
│ Featured shops in Bijnor (scroll)                         │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│ │Bagga   │ │City    │ │Electro │ │Fashion │               │
│ │Cloth★4.5│ │Sports★4.2│ │Hub ★4.7│ │Hub ★4.0│             │
│ │1.2 km  │ │2.5 km  │ │0.8 km │ │3.1 km │                 │
│ └────────┘ └────────┘ └────────┘ └────────┘               │
│ Popular products            Offers 🎉                     │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                   │
│ │[img]   ││[img]   ││[img]   ││[img]   │                  │
│ │Shirt   ││Nike Air││Mixer  ││Kurta   │                  │
│ │₹799    ││₹3,299  ││₹2,499 ││₹599    │                  │
│ │Bagga   ││City    ││Electro ││Fashion │                  │
│ │🟢90min ││🟢2hr   ││🟢1hr  ││🟢90min │                  │
│ └────────┘└────────┘└────────┘└────────┘                  │
└──────────────────────────────────────────────────────────┘
```

## 2. Search Results (filters + cross-shop comparison)
```
┌───────────────┬──────────────────────────────────────────┐
│ FILTERS       │ 🔍 "nike shoes" (Bijnor)                  │
│ Price ▾       │ Sort: [Price↓][Nearest][ETA][Rating]     │
│ ○ <₹1000      │ ┌──────────────────────────────────────┐ │
│ ● ₹1-3k       │ │ [img] Nike Air Max 270 ⭐4.4 (128)   │ │
│ ○ >₹3k        │ │ 3 offers in Bijnor                   │ │
│ Brand: Nike ● │ │ ┌────────────────────────────────┐  │ │
│ Size: [8][9]● │ │ │🏆 City Sports 2.5km│₹3,299│🟢InStk│  │ │
│  [10]         │ │ │   Fashion Hub 0.8km│₹3,699│🟢InStk│  │ │
│ Shop: All ▾   │ │ │   Bagga Cloth 1.2km│OUT OF STOCK  │  │ │
│ Dist ≤5km     │ │ └────────────────────────────────┘  │ │
│ Rating ≥4★    │ │ [Add to Cart] [Buy Now] · ETA 90min │ │
└───────────────┴─┴────────────────────────────────────┴───┘
```

## 3. Product Page (PDP) — offers table = core feature
```
┌────────────────────┬─────────────────────────────────────┐
│  [img][img][img]    │ Nike Air Max 270  ⭐4.4 (128)      │
│                     │ Brand Nike · Shoes                  │
│                     │ Size [7][8][9][10] Colour [Black]  │
│                     │ OFFERS FROM LOCAL SHOPS (Bijnor):   │
│                     │ ┌─────────────────────────────────┐│
│                     │ │🏆 City Sports · 2.5 km · ⭐4.2    ││
│                     │ │  ₹3,299 (MRP ₹4,999) 34% OFF     ││
│                     │ │  🟢 In stock · 🛵 90 min         ││
│                     │ │  [Add to Cart]                   ││
│                     │ ├─────────────────────────────────┤│
│                     │ │ Fashion Hub · 0.8 km · ⭐4.7     ││
│                     │ │  ₹3,699 · 🟢 In stock · 🛵 75 min ││
│                     │ ├─────────────────────────────────┤│
│                     │ │ Bagga Cloth · OUT OF STOCK      ││
│                     │ └─────────────────────────────────┘│
│                     │ 🛡 Verified shop · ↩ 7-day returns │
├────────────────────┴─────────────────────────────────────┤
│ REVIEWS(128) · [Shop: City Sports →] · Similar products  │
└──────────────────────────────────────────────────────────┘
```

## 4. Shop Storefront (bagga-cloth.apnacity.com — auto-created)
```
┌──────────────────────────────────────────────────────────┐
│ [═══ BAGGA CLOTH banner ═══] ⭐4.5(62) · Bijnor · 1.2 km   │
│ 📍 Main Market, Bijnor · 🕐 9am–9pm · 🛵 Local delivery   │
│ [Shop][Products(214)][Offers(12)][Reviews][About] 🔍in shop│
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐                  │
│ │Shirt  ││Kurta ││Jeans ││Saree ││ …    │                 │
│ │₹799   ││₹599  ││₹1,199││₹1,999│        │                 │
│ │🟢InStk││🟢InStk││🟡3   ││🟢InStk│        │                 │
│ └──────┘└──────┘└──────┘└──────┘└──────┘                  │
│ About: Family store since 1995 · Returns 7 days · COD ✓ UPI ✓│
└──────────────────────────────────────────────────────────┘
```

## 5. Cart → Checkout (multi-shop split, one payment)
```
┌──────────────────────────────────────────────────────────┐
│ YOUR CART (4 items)                          [Checkout →] │
│ 🏪 BAGGA CLOTH (2)            Subtotal ₹1,398             │
│  [img] Cotton Shirt M ×1 ₹799 [− qty +] [🗑]              │
│  [img] Kurta L ×1        ₹599 [− qty +] [🗑]              │
│  🛵 Delivery ₹40 · 90 min                                 │
│ 🏪 CITY SPORTS (2)           Subtotal ₹5,498              │
│  [img] Nike Air Max 270 ×1 ₹3,299 [− qty +] [🗑]         │
│  [img] Socks ×2          ₹2,200 [− qty +] [🗑]            │
│  ⚠ Only 1 left — price updated just now                  │
│ ──────────────────────────────────────────                │
│ Address: 📍 Home — Nehru Nagar, Bijnor ▾                  │
│ Items ₹6,896 + Delivery ₹90 − Coupon [APNA50 −₹50]        │
│ PAY: ( )UPI ( )Card ( )Netbanking ( )COD                  │
│                              [ Pay ₹6,936 → ]             │
└──────────────────────────────────────────────────────────┘
```

## 6. Order Tracking (customer, live)
```
┌──────────────────────────────────────────────────────────┐
│ ORDER APN-2026-000123                     ₹6,936  ⏱ live  │
│ Package 1 — Bagga Cloth            [Chat] [Help]          │
│ ✅Placed 2:01 ✅Accepted 2:04 ✅Packed 2:20 🛵Picked 2:35  │
│ ┌────────────────────────────┐  Delivery OTP:             │
│ │      [ LIVE MAP ]          │  [4][7][2][9] ETA 3:15 PM  │
│ │  🛍 ────🛵──── 🏠          │  Rider: Imran ⭐4.8 [📞]   │
│ └────────────────────────────┘                           │
│ Package 2 — City Sports   ⏳ Accept by 2:14 PM            │
└──────────────────────────────────────────────────────────┘
```

## 7. Seller Portal — Orders Inbox (the money screen)
```
┌──────────────────────────────────────────────────────────┐
│ Bagga Cloth ▾  💰₹12,450  📦New(1)  ⚠Low stock(3)   🌸/EN │
│ 🔔 NEW ORDER — APN-2026-000123 · ₹799 · 10:00 left       │
│   Cotton Shirt M ×1 · Nehru Nagar (1.8 km) · COD ₹799    │
│   [ ✅ ACCEPT ]   [ ✖ REJECT (out of stock) ]             │
│ APN-000118  PREPARING ₹1,398  [ ✓ Mark Ready ]           │
│ APN-000117  🛵 OUT FOR DELIVERY ₹599   track →           │
│ APN-000116  ✅ DELIVERED ₹1,199  → settlement             │
└──────────────────────────────────────────────────────────┘
```

## 8. Seller — Product Wizard (5 steps, <60 s)
```
┌──────────────────────────────────────────────────────────┐
│ + ADD PRODUCT       ●─●─○─○─○  (step 2: Details)        │
│ Step 1 Photos:  [📷 Take photo] (up to 6, auto-compress) │
│ Step 2 Details: name · category ▾ · brand · size[] color[]│
│ Step 3 Price:   SKU · MRP ₹1,199 · Price ₹799 · Stock 25 │
│ Step 4 Delivery: weight 250 g · self/platform delivery   │
│ Step 5 ✅ Publish → live on your website + Bijnor search  │
└──────────────────────────────────────────────────────────┘
```

## 9. Rider App (mobile)
```
┌────────────────────┐
│ 🛵 Available ● ON   │
│ NEW JOB ₹35 · 1.8km │
│ Pickup: Bagga Cloth │
│ Drop: Nehru Nagar   │
│ 9:00 min to accept  │
│ [✅ACCEPT] [✖SKIP]   │
├────────────────────┤
│ ACTIVE APN-000118   │
│ [🧭 Navigate]       │
│ [📦 Picked up]      │
│ At drop: OTP _ _ _ _│
│ [📸 PoD][✓Delivered]│
├────────────────────┤
│ Today: ₹315 (9 jobs)│
└────────────────────┘
```

## 10. Admin Portal
```
┌──────────────────────────────────────────────────────────┐
│ KYC(4) Merge(6) Orders Disputes(2) COD Settle Config Flags│
│ ⏳ Bagga Cloth · PAN✓ GST✓ bank✓  [Approve✅][Reject✖]    │
│    → approved → shop live at bagga-cloth.apnacity.com    │
│ Orders: APN-000123 ▸ full event timeline ▸ [Refund ₹799]  │
│ Settlements: Batch #45 ₹86,340 → [Release — 2-person ✓]  │
│ Analytics: city dashboard · seller health · SLO alerts    │
└──────────────────────────────────────────────────────────┘
```

## 11. City Landing (bijnor.apnacity.com)
```
┌──────────────────────────────────────────────────────────┐
│  APNACITY BIJNOR — आपका शहर, आपकी दुकानें                │
│  [🔍 Search 200+ local shops…]      [🛍 All shops →]       │
│  ● Categories · ● Today's offers · ● New shops · Top rated│
└──────────────────────────────────────────────────────────┘
```

## 12. Mobile Customer (Expo)
Tabs: 🏠 Home · 🔍 Search · 🛒 Cart(3) · 📦 Orders · 👤 Profile
OTP login · UPI intent at checkout · live tracking · push · deep links
