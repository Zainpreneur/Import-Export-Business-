;; import-export.clar
;;
;; Core on-chain business model for an Import/Export trading operation.
;; Built for the Stacks blockchain and driven from the frontend via Stacks.js
;; (@stacks/connect + @stacks/transactions).
;;
;; Covers the "core operations" of the business:
;;   1. Parties      - suppliers / exporters and clients / importers
;;   2. Products      - the inventory that is traded across borders
;;   3. Orders         - import or export trade orders between two parties
;;   4. Shipments      - status tracking of an order as it moves through
;;                       customs and logistics, plus on-chain settlement
;;
;; All STX amounts are in micro-STX (1 STX = 1,000,000 micro-STX).

;; -----------------------------------------------------------------------
;; Constants
;; -----------------------------------------------------------------------

(define-constant CONTRACT-OWNER tx-sender)

;; Party types
(define-constant PARTY-TYPE-SUPPLIER u1)  ;; exporter / seller
(define-constant PARTY-TYPE-CLIENT u2)    ;; importer / buyer

;; Order types
(define-constant ORDER-TYPE-EXPORT u1)
(define-constant ORDER-TYPE-IMPORT u2)

;; Order / shipment status pipeline
(define-constant STATUS-CREATED u0)
(define-constant STATUS-CONFIRMED u1)
(define-constant STATUS-SHIPPED u2)
(define-constant STATUS-IN-TRANSIT u3)
(define-constant STATUS-CUSTOMS-CLEARED u4)
(define-constant STATUS-DELIVERED u5)
(define-constant STATUS-CANCELLED u6)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-PARTY-NOT-FOUND (err u101))
(define-constant ERR-PARTY-ALREADY-REGISTERED (err u102))
(define-constant ERR-PARTY-INACTIVE (err u103))
(define-constant ERR-INVALID-PARTY-TYPE (err u104))
(define-constant ERR-PRODUCT-NOT-FOUND (err u105))
(define-constant ERR-NOT-PRODUCT-OWNER (err u106))
(define-constant ERR-INSUFFICIENT-INVENTORY (err u107))
(define-constant ERR-INVALID-QUANTITY (err u108))
(define-constant ERR-ORDER-NOT-FOUND (err u109))
(define-constant ERR-INVALID-ORDER-TYPE (err u110))
(define-constant ERR-NOT-ORDER-PARTY (err u111))
(define-constant ERR-INVALID-STATUS-TRANSITION (err u112))
(define-constant ERR-ORDER-ALREADY-PAID (err u113))
(define-constant ERR-ORDER-NOT-CONFIRMED (err u114))
(define-constant ERR-ORDER-NOT-PAYABLE (err u115))
(define-constant ERR-TRANSFER-FAILED (err u116))

;; -----------------------------------------------------------------------
;; Data variables (counters)
;; -----------------------------------------------------------------------

(define-data-var next-party-id uint u1)
(define-data-var next-product-id uint u1)
(define-data-var next-order-id uint u1)

;; -----------------------------------------------------------------------
;; Data maps
;; -----------------------------------------------------------------------

;; Registered suppliers (exporters) and clients (importers)
(define-map parties
  { party-id: uint }
  {
    owner: principal,
    name: (string-ascii 64),
    party-type: uint,        ;; PARTY-TYPE-SUPPLIER | PARTY-TYPE-CLIENT
    country: (string-ascii 32),
    active: bool
  }
)

;; principal -> party-id, so a wallet only ever registers once
(define-map party-ids-by-principal principal uint)

;; Product / inventory catalog, owned by a supplier
(define-map products
  { product-id: uint }
  {
    owner: principal,
    supplier-id: uint,
    name: (string-ascii 64),
    hs-code: (string-ascii 16),      ;; Harmonized System customs code
    origin-country: (string-ascii 32),
    unit-price: uint,                ;; micro-STX per unit
    quantity: uint                   ;; units currently in stock
  }
)

;; Trade orders between a buyer and a seller for a given product
(define-map orders
  { order-id: uint }
  {
    buyer: principal,
    seller: principal,
    product-id: uint,
    order-type: uint,        ;; ORDER-TYPE-EXPORT | ORDER-TYPE-IMPORT
    quantity: uint,
    unit-price: uint,
    total-price: uint,
    status: uint,
    paid: bool,
    tracking-number: (optional (string-ascii 32)),
    created-at: uint         ;; block height at creation
  }
)

;; -----------------------------------------------------------------------
;; Private helpers
;; -----------------------------------------------------------------------

(define-private (is-contract-owner (who principal))
  (is-eq who CONTRACT-OWNER)
)

(define-private (get-party-or-fail (party-id uint))
  (map-get? parties { party-id: party-id })
)

;; -----------------------------------------------------------------------
;; Party management
;; -----------------------------------------------------------------------

(define-public (register-party (name (string-ascii 64)) (party-type uint) (country (string-ascii 32)))
  (let ((caller tx-sender) (id (var-get next-party-id)))
    (asserts! (is-none (map-get? party-ids-by-principal caller)) ERR-PARTY-ALREADY-REGISTERED)
    (asserts! (or (is-eq party-type PARTY-TYPE-SUPPLIER) (is-eq party-type PARTY-TYPE-CLIENT)) ERR-INVALID-PARTY-TYPE)
    (map-set parties { party-id: id }
      { owner: caller, name: name, party-type: party-type, country: country, active: true })
    (map-set party-ids-by-principal caller id)
    (var-set next-party-id (+ id u1))
    (ok id)
  )
)

(define-public (set-party-active (party-id uint) (active bool))
  (let ((party (unwrap! (get-party-or-fail party-id) ERR-PARTY-NOT-FOUND)))
    (asserts! (or (is-eq tx-sender (get owner party)) (is-contract-owner tx-sender)) ERR-NOT-AUTHORIZED)
    (map-set parties { party-id: party-id } (merge party { active: active }))
    (ok true)
  )
)

(define-read-only (get-party (party-id uint))
  (map-get? parties { party-id: party-id })
)

(define-read-only (get-party-id-of (who principal))
  (map-get? party-ids-by-principal who)
)

(define-read-only (get-total-parties)
  (- (var-get next-party-id) u1)
)

;; -----------------------------------------------------------------------
;; Product / inventory management
;; -----------------------------------------------------------------------

(define-public (add-product
    (supplier-id uint)
    (name (string-ascii 64))
    (hs-code (string-ascii 16))
    (origin-country (string-ascii 32))
    (unit-price uint)
    (quantity uint))
  (let ((caller tx-sender) (party (unwrap! (get-party-or-fail supplier-id) ERR-PARTY-NOT-FOUND)) (id (var-get next-product-id)))
    (asserts! (is-eq (get owner party) caller) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get party-type party) PARTY-TYPE-SUPPLIER) ERR-INVALID-PARTY-TYPE)
    (asserts! (get active party) ERR-PARTY-INACTIVE)
    (asserts! (> unit-price u0) ERR-INVALID-QUANTITY)
    (map-set products { product-id: id }
      {
        owner: caller,
        supplier-id: supplier-id,
        name: name,
        hs-code: hs-code,
        origin-country: origin-country,
        unit-price: unit-price,
        quantity: quantity
      })
    (var-set next-product-id (+ id u1))
    (ok id)
  )
)

(define-public (update-inventory (product-id uint) (quantity uint))
  (let ((product (unwrap! (map-get? products { product-id: product-id }) ERR-PRODUCT-NOT-FOUND)))
    (asserts! (is-eq (get owner product) tx-sender) ERR-NOT-PRODUCT-OWNER)
    (map-set products { product-id: product-id } (merge product { quantity: quantity }))
    (ok true)
  )
)

(define-public (update-unit-price (product-id uint) (unit-price uint))
  (let ((product (unwrap! (map-get? products { product-id: product-id }) ERR-PRODUCT-NOT-FOUND)))
    (asserts! (is-eq (get owner product) tx-sender) ERR-NOT-PRODUCT-OWNER)
    (asserts! (> unit-price u0) ERR-INVALID-QUANTITY)
    (map-set products { product-id: product-id } (merge product { unit-price: unit-price }))
    (ok true)
  )
)

(define-read-only (get-product (product-id uint))
  (map-get? products { product-id: product-id })
)

(define-read-only (get-total-products)
  (- (var-get next-product-id) u1)
)

;; -----------------------------------------------------------------------
;; Orders & shipment tracking
;; -----------------------------------------------------------------------

;; A registered client (buyer) opens a trade order against a supplier's product.
;; order-type: ORDER-TYPE-EXPORT when the buyer is importing goods that leave
;; the seller's country, ORDER-TYPE-IMPORT when the buyer is bringing goods in
;; from abroad -- the tag is business metadata used for customs reporting,
;; the settlement mechanics are identical either way.
(define-public (create-order (product-id uint) (quantity uint) (order-type uint))
  (let (
        (buyer tx-sender)
        (product (unwrap! (map-get? products { product-id: product-id }) ERR-PRODUCT-NOT-FOUND))
        (id (var-get next-order-id))
       )
    (asserts! (or (is-eq order-type ORDER-TYPE-EXPORT) (is-eq order-type ORDER-TYPE-IMPORT)) ERR-INVALID-ORDER-TYPE)
    (asserts! (> quantity u0) ERR-INVALID-QUANTITY)
    (asserts! (>= (get quantity product) quantity) ERR-INSUFFICIENT-INVENTORY)
    (asserts! (not (is-eq buyer (get owner product))) ERR-NOT-AUTHORIZED)

    ;; reserve inventory immediately so it can't be oversold while the order
    ;; works its way through confirmation and shipment
    (map-set products { product-id: product-id }
      (merge product { quantity: (- (get quantity product) quantity) }))

    (map-set orders { order-id: id }
      {
        buyer: buyer,
        seller: (get owner product),
        product-id: product-id,
        order-type: order-type,
        quantity: quantity,
        unit-price: (get unit-price product),
        total-price: (* (get unit-price product) quantity),
        status: STATUS-CREATED,
        paid: false,
        tracking-number: none,
        created-at: stacks-block-height
      })
    (var-set next-order-id (+ id u1))
    (ok id)
  )
)

;; Seller confirms they will fulfil the order.
(define-public (confirm-order (order-id uint))
  (let ((order (unwrap! (map-get? orders { order-id: order-id }) ERR-ORDER-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get seller order)) ERR-NOT-ORDER-PARTY)
    (asserts! (is-eq (get status order) STATUS-CREATED) ERR-INVALID-STATUS-TRANSITION)
    (map-set orders { order-id: order-id } (merge order { status: STATUS-CONFIRMED }))
    (ok true)
  )
)

;; Buyer settles payment in STX once the order is confirmed.
(define-public (pay-order (order-id uint))
  (let ((order (unwrap! (map-get? orders { order-id: order-id }) ERR-ORDER-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get buyer order)) ERR-NOT-ORDER-PARTY)
    (asserts! (is-eq (get status order) STATUS-CONFIRMED) ERR-ORDER-NOT-CONFIRMED)
    (asserts! (not (get paid order)) ERR-ORDER-ALREADY-PAID)
    (try! (stx-transfer? (get total-price order) tx-sender (get seller order)))
    (map-set orders { order-id: order-id } (merge order { paid: true }))
    (ok true)
  )
)

;; Seller (or the contract admin, for dispute resolution) advances the
;; shipment through the logistics/customs pipeline in strict sequence.
(define-public (update-shipment-status
    (order-id uint)
    (new-status uint)
    (tracking-number (optional (string-ascii 32))))
  (let ((order (unwrap! (map-get? orders { order-id: order-id }) ERR-ORDER-NOT-FOUND)))
    (asserts! (or (is-eq tx-sender (get seller order)) (is-contract-owner tx-sender)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (- new-status (get status order)) u1) ERR-INVALID-STATUS-TRANSITION)
    (asserts! (<= new-status STATUS-DELIVERED) ERR-INVALID-STATUS-TRANSITION)
    (map-set orders { order-id: order-id }
      (merge order {
        status: new-status,
        tracking-number: (match tracking-number tn (some tn) (get tracking-number order))
      }))
    (ok true)
  )
)

;; Either party can cancel before the goods have shipped; reserved
;; inventory is released back to the seller's stock.
(define-public (cancel-order (order-id uint))
  (let (
        (order (unwrap! (map-get? orders { order-id: order-id }) ERR-ORDER-NOT-FOUND))
        (product (unwrap! (map-get? products { product-id: (get product-id order) }) ERR-PRODUCT-NOT-FOUND))
       )
    (asserts! (or (is-eq tx-sender (get buyer order)) (is-eq tx-sender (get seller order))) ERR-NOT-ORDER-PARTY)
    (asserts! (< (get status order) STATUS-SHIPPED) ERR-INVALID-STATUS-TRANSITION)
    (map-set products { product-id: (get product-id order) }
      (merge product { quantity: (+ (get quantity product) (get quantity order)) }))
    (map-set orders { order-id: order-id } (merge order { status: STATUS-CANCELLED }))
    (ok true)
  )
)

(define-read-only (get-order (order-id uint))
  (map-get? orders { order-id: order-id })
)

(define-read-only (get-order-status (order-id uint))
  (match (map-get? orders { order-id: order-id })
    order (ok (get status order))
    ERR-ORDER-NOT-FOUND
  )
)

(define-read-only (get-total-orders)
  (- (var-get next-order-id) u1)
)
