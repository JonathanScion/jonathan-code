-- ============================================
-- Test Database Modification Script for ContextFreeSQL
-- Run this AFTER setup_test_db.sql to create differences
--
-- This script tests FK ordering by making changes at ALL levels:
-- - Level 0 (no FK): categories, suppliers, customers
-- - Level 1 (FK to L0): products (FK to categories, suppliers)
-- - Level 2 (FK to L1/L0): orders (FK to customers), order_items (FK to orders, products)
-- - Level 3: inventory.stock_movements (FK to products)
--
-- When reverting these changes, ContextFreeSQL must:
-- - DELETE in order: order_items -> orders -> products/stock_movements -> categories/suppliers/customers
-- - INSERT in order: categories/suppliers/customers -> products -> orders -> order_items/stock_movements
-- ============================================

-- ============================================
-- LEVEL 0 CHANGES: categories, suppliers, customers (no FK dependencies)
-- ============================================

-- Ensure sequences are in sync (in case of partial runs or resets)
SELECT setval('public.categories_category_id_seq',
    COALESCE((SELECT MAX(category_id) FROM public.categories), 0));
SELECT setval('public.suppliers_supplier_id_seq',
    COALESCE((SELECT MAX(supplier_id) FROM public.suppliers), 0));
SELECT setval('public.customers_customer_id_seq',
    COALESCE((SELECT MAX(customer_id) FROM public.customers), 0));

-- Categories: INSERT new, UPDATE existing, DELETE one
INSERT INTO public.categories (category_name, description, is_active, created_at) VALUES
('Sports & Outdoors', 'Sporting goods and outdoor equipment', true, '2024-01-01 10:00:00'),
('Toys & Games', 'Toys, games, and entertainment', true, '2024-01-01 10:00:00');

UPDATE public.categories
SET description = 'Updated: Electronic devices, gadgets, and accessories',
    is_active = true
WHERE category_name = 'Electronics';

DELETE FROM public.categories WHERE category_name = 'Home & Garden';

-- Suppliers: INSERT new, UPDATE existing
INSERT INTO public.suppliers (supplier_name, contact_email, phone, address, rating, created_at) VALUES
('Outdoor Gear Co.', 'info@outdoorgear.com', '555-0201', '321 Adventure Way, Denver, CO', 4.75, '2024-01-01 10:00:00'),
('Game Masters Inc.', 'sales@gamemasters.com', '555-0202', '555 Fun Street, Orlando, FL', 4.60, '2024-01-01 10:00:00');

UPDATE public.suppliers
SET rating = 4.80,
    address = '123 Tech Park Drive, Silicon Valley, CA 94000'
WHERE supplier_name = 'TechCorp Inc.';

-- Customers: INSERT new, UPDATE existing, DELETE one
INSERT INTO public.customers (first_name, last_name, email, phone, loyalty_points, registered_at) VALUES
('Charlie', 'Brown', 'charlie.b@email.com', '555-2001', 50, '2024-01-01 10:00:00'),
('Diana', 'Prince', 'diana.p@email.com', '555-2002', 150, '2024-01-01 10:00:00'),
('Edward', 'Norton', 'edward.n@email.com', '555-2003', 75, '2024-01-01 10:00:00');

UPDATE public.customers
SET loyalty_points = 300,
    email = 'john.smith.updated@email.com'
WHERE first_name = 'John' AND last_name = 'Smith';

-- Delete a customer (this will CASCADE to their orders and order_items)
DELETE FROM public.customers WHERE first_name = 'Bob' AND last_name = 'Johnson';

-- ============================================
-- LEVEL 1 CHANGES: products (FK to categories, suppliers)
-- ============================================

-- Ensure sequence is in sync
SELECT setval('public.products_product_id_seq',
    COALESCE((SELECT MAX(product_id) FROM public.products), 0));

-- Products: INSERT new (referencing existing and new categories/suppliers)
INSERT INTO public.products (product_name, category_id, supplier_id, unit_price, units_in_stock, is_discontinued, created_at)
SELECT 'Bluetooth Headphones', c.category_id, s.supplier_id, 79.99, 60, false, '2024-01-01 10:00:00'
FROM public.categories c, public.suppliers s
WHERE c.category_name = 'Electronics' AND s.supplier_name = 'TechCorp Inc.';

INSERT INTO public.products (product_name, category_id, supplier_id, unit_price, units_in_stock, is_discontinued, created_at)
SELECT 'Camping Tent', c.category_id, s.supplier_id, 149.99, 30, false, '2024-01-01 10:00:00'
FROM public.categories c, public.suppliers s
WHERE c.category_name = 'Sports & Outdoors' AND s.supplier_name = 'Outdoor Gear Co.';

INSERT INTO public.products (product_name, category_id, supplier_id, unit_price, units_in_stock, is_discontinued, created_at)
SELECT 'Board Game Collection', c.category_id, s.supplier_id, 59.99, 100, false, '2024-01-01 10:00:00'
FROM public.categories c, public.suppliers s
WHERE c.category_name = 'Toys & Games' AND s.supplier_name = 'Game Masters Inc.';

INSERT INTO public.products (product_name, category_id, supplier_id, unit_price, units_in_stock, is_discontinued, created_at)
SELECT 'Hiking Boots', c.category_id, s.supplier_id, 89.99, 45, false, '2024-01-01 10:00:00'
FROM public.categories c, public.suppliers s
WHERE c.category_name = 'Sports & Outdoors' AND s.supplier_name = 'Outdoor Gear Co.';

-- Products: UPDATE existing
UPDATE public.products
SET unit_price = 34.99,
    units_in_stock = 175
WHERE product_name = 'Wireless Mouse';

UPDATE public.products
SET unit_price = 54.99,
    is_discontinued = false
WHERE product_name = 'USB-C Hub';

-- Products: DELETE (will fail if order_items reference it - tests FK ordering)
DELETE FROM public.products WHERE product_name = 'Vintage Keyboard';

-- ============================================
-- LEVEL 2 CHANGES: orders (FK to customers), order_items (FK to orders, products)
-- ============================================

-- Ensure sequences are in sync
SELECT setval('public.orders_order_id_seq',
    COALESCE((SELECT MAX(order_id) FROM public.orders), 0));
SELECT setval('public.order_items_order_item_id_seq',
    COALESCE((SELECT MAX(order_item_id) FROM public.order_items), 0));

-- Orders: INSERT new orders for existing and new customers
INSERT INTO public.orders (customer_id, order_date, ship_date, status, total_amount, notes)
SELECT c.customer_id, '2024-02-01', '2024-02-03', 'delivered', 79.99, 'New headphones order'
FROM public.customers c WHERE c.first_name = 'Alice';

INSERT INTO public.orders (customer_id, order_date, ship_date, status, total_amount, notes)
SELECT c.customer_id, '2024-02-05', NULL, 'pending', 149.99, 'Camping gear order'
FROM public.customers c WHERE c.first_name = 'Charlie';

INSERT INTO public.orders (customer_id, order_date, ship_date, status, total_amount, notes)
SELECT c.customer_id, '2024-02-10', '2024-02-12', 'shipped', 59.99, 'Game order'
FROM public.customers c WHERE c.first_name = 'Diana';

-- Orders: UPDATE existing
UPDATE public.orders
SET status = 'delivered',
    ship_date = '2024-01-22'
WHERE order_id = 3;

-- Order Items: INSERT new (referencing new orders and products)
-- For Alice's headphones order
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, discount)
SELECT o.order_id, p.product_id, 1, 79.99, 0.00
FROM public.orders o
JOIN public.customers c ON o.customer_id = c.customer_id
JOIN public.products p ON p.product_name = 'Bluetooth Headphones'
WHERE c.first_name = 'Alice' AND o.order_date = '2024-02-01';

-- For Charlie's camping order
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, discount)
SELECT o.order_id, p.product_id, 1, 149.99, 10.00
FROM public.orders o
JOIN public.customers c ON o.customer_id = c.customer_id
JOIN public.products p ON p.product_name = 'Camping Tent'
WHERE c.first_name = 'Charlie' AND o.order_date = '2024-02-05';

-- Add hiking boots to Charlie's order too
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, discount)
SELECT o.order_id, p.product_id, 1, 89.99, 5.00
FROM public.orders o
JOIN public.customers c ON o.customer_id = c.customer_id
JOIN public.products p ON p.product_name = 'Hiking Boots'
WHERE c.first_name = 'Charlie' AND o.order_date = '2024-02-05';

-- For Diana's game order
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, discount)
SELECT o.order_id, p.product_id, 1, 59.99, 0.00
FROM public.orders o
JOIN public.customers c ON o.customer_id = c.customer_id
JOIN public.products p ON p.product_name = 'Board Game Collection'
WHERE c.first_name = 'Diana' AND o.order_date = '2024-02-10';

-- Order Items: UPDATE existing
UPDATE public.order_items
SET quantity = 3,
    discount = 5.00
WHERE order_item_id = 1;

-- ============================================
-- LEVEL 3 CHANGES: inventory.stock_movements (FK to products)
-- ============================================

-- Ensure sequence is in sync (in case of partial runs or resets)
SELECT setval('inventory.stock_movements_movement_id_seq',
    COALESCE((SELECT MAX(movement_id) FROM inventory.stock_movements), 0));

-- Add movements for new products
INSERT INTO inventory.stock_movements (product_id, movement_type, quantity, reference_note, movement_date)
SELECT p.product_id, 'IN', 100, 'Initial stock for headphones', '2024-02-01 10:00:00'
FROM public.products p WHERE p.product_name = 'Bluetooth Headphones';

INSERT INTO inventory.stock_movements (product_id, movement_type, quantity, reference_note, movement_date)
SELECT p.product_id, 'OUT', 40, 'February sales', '2024-02-15 10:00:00'
FROM public.products p WHERE p.product_name = 'Bluetooth Headphones';

INSERT INTO inventory.stock_movements (product_id, movement_type, quantity, reference_note, movement_date)
SELECT p.product_id, 'IN', 50, 'Initial stock for tents', '2024-02-01 10:00:00'
FROM public.products p WHERE p.product_name = 'Camping Tent';

INSERT INTO inventory.stock_movements (product_id, movement_type, quantity, reference_note, movement_date)
SELECT p.product_id, 'IN', 150, 'Initial stock for games', '2024-02-01 10:00:00'
FROM public.products p WHERE p.product_name = 'Board Game Collection';

INSERT INTO inventory.stock_movements (product_id, movement_type, quantity, reference_note, movement_date)
SELECT p.product_id, 'OUT', 50, 'February game sales', '2024-02-20 10:00:00'
FROM public.products p WHERE p.product_name = 'Board Game Collection';

-- Update existing movements
UPDATE inventory.stock_movements
SET quantity = 225,
    reference_note = 'Updated initial stock count'
WHERE movement_id = 1;

-- Delete a movement
DELETE FROM inventory.stock_movements WHERE movement_id = 2;

-- ============================================
-- SCHEMA CHANGES: COLUMNS (ADD, DROP, ALTER)
-- ============================================

-- ADD new columns to various tables
ALTER TABLE public.categories
ADD COLUMN display_order INTEGER DEFAULT 0;

ALTER TABLE public.categories
ADD COLUMN icon_url VARCHAR(500);

ALTER TABLE public.suppliers
ADD COLUMN website VARCHAR(255);

ALTER TABLE public.suppliers
ADD COLUMN is_preferred BOOLEAN DEFAULT false;

ALTER TABLE public.products
ADD COLUMN weight_kg DECIMAL(8, 2);

ALTER TABLE public.products
ADD COLUMN sku VARCHAR(50);

ALTER TABLE public.customers
ADD COLUMN date_of_birth DATE;

ALTER TABLE public.customers
ADD COLUMN newsletter_subscribed BOOLEAN DEFAULT true;

ALTER TABLE public.orders
ADD COLUMN shipping_method VARCHAR(50) DEFAULT 'standard';

ALTER TABLE public.orders
ADD COLUMN tracking_number VARCHAR(100);

ALTER TABLE public.order_items
ADD COLUMN notes TEXT;

ALTER TABLE inventory.stock_movements
ADD COLUMN performed_by VARCHAR(100);

-- DROP a column (products.is_discontinued)
ALTER TABLE public.products
DROP COLUMN is_discontinued;

-- ALTER column types
ALTER TABLE public.suppliers
ALTER COLUMN phone TYPE VARCHAR(30);

ALTER TABLE public.customers
ALTER COLUMN phone TYPE VARCHAR(30);

-- ALTER column nullability (make nullable column NOT NULL - need default first)
UPDATE public.products SET weight_kg = 0.5 WHERE weight_kg IS NULL;
ALTER TABLE public.products
ALTER COLUMN weight_kg SET NOT NULL;

-- ALTER column default
ALTER TABLE public.products
ALTER COLUMN units_in_stock SET DEFAULT 10;

ALTER TABLE public.orders
ALTER COLUMN status SET DEFAULT 'new';

-- DROP column default
ALTER TABLE public.categories
ALTER COLUMN is_active DROP DEFAULT;

-- Populate the new columns with data
UPDATE public.categories SET display_order = 1 WHERE category_name = 'Electronics';
UPDATE public.categories SET display_order = 2 WHERE category_name = 'Books';
UPDATE public.categories SET display_order = 3 WHERE category_name = 'Clothing';
UPDATE public.categories SET display_order = 4 WHERE category_name = 'Sports & Outdoors';
UPDATE public.categories SET display_order = 5 WHERE category_name = 'Toys & Games';
UPDATE public.categories SET icon_url = 'https://example.com/icons/electronics.png' WHERE category_name = 'Electronics';

UPDATE public.suppliers SET website = 'https://techcorp.example.com', is_preferred = true WHERE supplier_name = 'TechCorp Inc.';
UPDATE public.suppliers SET website = 'https://bookworld.example.com' WHERE supplier_name = 'BookWorld Publishers';

UPDATE public.products SET sku = 'ELEC-MOUSE-001', weight_kg = 0.15 WHERE product_name = 'Wireless Mouse';
UPDATE public.products SET sku = 'ELEC-HUB-001', weight_kg = 0.25 WHERE product_name = 'USB-C Hub';
UPDATE public.products SET sku = 'BOOK-PROG-001', weight_kg = 0.80 WHERE product_name = 'Programming Guide';

UPDATE public.customers SET date_of_birth = '1985-03-15', newsletter_subscribed = true WHERE first_name = 'John';
UPDATE public.customers SET date_of_birth = '1990-07-22', newsletter_subscribed = false WHERE first_name = 'Jane';

UPDATE public.orders SET shipping_method = 'express', tracking_number = 'TRK123456' WHERE order_id = 1;
UPDATE public.orders SET shipping_method = 'standard', tracking_number = 'TRK789012' WHERE order_id = 2;

UPDATE public.order_items SET notes = 'Gift wrap requested' WHERE order_item_id = 1;

UPDATE inventory.stock_movements SET performed_by = 'warehouse_admin' WHERE movement_id = 1;

-- ============================================
-- SCHEMA CHANGES: INDEXES (ADD, DROP)
-- ============================================

-- ADD new indexes
CREATE INDEX idx_categories_display_order ON public.categories (display_order);

CREATE INDEX idx_suppliers_rating ON public.suppliers (rating DESC);

CREATE INDEX idx_products_sku ON public.products (sku);

CREATE INDEX idx_products_price_stock ON public.products (unit_price, units_in_stock);

CREATE INDEX idx_customers_email_lower ON public.customers (LOWER(email));

CREATE INDEX idx_customers_loyalty ON public.customers (loyalty_points DESC);

CREATE INDEX idx_orders_status_date ON public.orders (status, order_date);

CREATE UNIQUE INDEX idx_products_sku_unique ON public.products (sku) WHERE sku IS NOT NULL;

-- DROP existing indexes
DROP INDEX IF EXISTS public.idx_products_category;

DROP INDEX IF EXISTS public.idx_orders_date;

-- ============================================
-- SCHEMA CHANGES: FOREIGN KEYS (ADD, DROP)
-- ============================================

-- DROP an existing FK
ALTER TABLE public.order_items
DROP CONSTRAINT fk_orderitem_product;

-- ADD a new FK with different options
ALTER TABLE public.order_items
ADD CONSTRAINT fk_orderitem_product_cascade
    FOREIGN KEY (product_id) REFERENCES public.products(product_id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ADD a completely new FK relationship (self-referential on categories for parent/child)
ALTER TABLE public.categories
ADD COLUMN parent_category_id INTEGER;

ALTER TABLE public.categories
ADD CONSTRAINT fk_category_parent
    FOREIGN KEY (parent_category_id) REFERENCES public.categories(category_id)
    ON DELETE SET NULL;

-- Set some parent relationships
UPDATE public.categories SET parent_category_id =
    (SELECT category_id FROM public.categories WHERE category_name = 'Electronics')
WHERE category_name IN ('Toys & Games');

-- ============================================
-- SCHEMA CHANGES: CHECK CONSTRAINTS (ADD, DROP)
-- ============================================

-- ADD check constraints
ALTER TABLE public.products
ADD CONSTRAINT chk_products_price_positive
    CHECK (unit_price >= 0);

ALTER TABLE public.products
ADD CONSTRAINT chk_products_stock_non_negative
    CHECK (units_in_stock >= 0);

ALTER TABLE public.suppliers
ADD CONSTRAINT chk_suppliers_rating_range
    CHECK (rating >= 0 AND rating <= 5);

ALTER TABLE public.orders
ADD CONSTRAINT chk_orders_valid_status
    CHECK (status IN ('new', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'));

ALTER TABLE public.order_items
ADD CONSTRAINT chk_orderitems_quantity_positive
    CHECK (quantity > 0);

ALTER TABLE public.order_items
ADD CONSTRAINT chk_orderitems_discount_range
    CHECK (discount >= 0 AND discount <= unit_price);

-- ============================================
-- SCHEMA CHANGES: TABLES (CREATE NEW, DROP)
-- ============================================

-- CREATE a new table
CREATE TABLE public.product_reviews (
    review_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified_purchase BOOLEAN DEFAULT false
);

CREATE INDEX idx_reviews_product ON public.product_reviews (product_id);
CREATE INDEX idx_reviews_customer ON public.product_reviews (customer_id);
CREATE INDEX idx_reviews_rating ON public.product_reviews (rating);

-- Insert some review data
INSERT INTO public.product_reviews (product_id, customer_id, rating, review_text, created_at, is_verified_purchase)
SELECT p.product_id, c.customer_id, 5, 'Excellent product! Highly recommend.', '2024-01-20 10:00:00', true
FROM public.products p, public.customers c
WHERE p.product_name = 'Wireless Mouse' AND c.first_name = 'John';

INSERT INTO public.product_reviews (product_id, customer_id, rating, review_text, created_at, is_verified_purchase)
SELECT p.product_id, c.customer_id, 4, 'Good value for money.', '2024-01-21 14:30:00', true
FROM public.products p, public.customers c
WHERE p.product_name = 'USB-C Hub' AND c.first_name = 'Jane';

INSERT INTO public.product_reviews (product_id, customer_id, rating, review_text, created_at, is_verified_purchase)
SELECT p.product_id, c.customer_id, 3, 'Decent but could be better.', '2024-01-22 09:15:00', false
FROM public.products p, public.customers c
WHERE p.product_name = 'Programming Guide' AND c.first_name = 'Alice';

-- CREATE another new table (for shipping addresses)
CREATE TABLE public.customer_addresses (
    address_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('billing', 'shipping', 'both')),
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'USA',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addresses_customer ON public.customer_addresses (customer_id);
CREATE UNIQUE INDEX idx_addresses_default ON public.customer_addresses (customer_id, address_type) WHERE is_default = true;

-- Insert address data
INSERT INTO public.customer_addresses (customer_id, address_type, street_address, city, state, postal_code, country, is_default)
SELECT customer_id, 'both', '123 Main St', 'New York', 'NY', '10001', 'USA', true
FROM public.customers WHERE first_name = 'John';

INSERT INTO public.customer_addresses (customer_id, address_type, street_address, city, state, postal_code, country, is_default)
SELECT customer_id, 'shipping', '456 Oak Ave', 'Los Angeles', 'CA', '90001', 'USA', true
FROM public.customers WHERE first_name = 'Jane';

INSERT INTO public.customer_addresses (customer_id, address_type, street_address, city, state, postal_code, country, is_default)
SELECT customer_id, 'billing', '789 Pine Rd', 'Los Angeles', 'CA', '90002', 'USA', false
FROM public.customers WHERE first_name = 'Jane';

-- CREATE a table in the inventory schema
CREATE TABLE inventory.warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    capacity INTEGER DEFAULT 10000,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO inventory.warehouses (warehouse_name, location, capacity, is_active) VALUES
('Main Warehouse', '100 Industrial Blvd, Chicago, IL', 50000, true),
('East Coast Hub', '200 Shipping Lane, Newark, NJ', 30000, true),
('West Coast Hub', '300 Pacific Way, Long Beach, CA', 25000, false);

-- Add warehouse_id to stock_movements (new FK)
ALTER TABLE inventory.stock_movements
ADD COLUMN warehouse_id INTEGER;

ALTER TABLE inventory.stock_movements
ADD CONSTRAINT fk_movements_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES inventory.warehouses(warehouse_id)
    ON DELETE SET NULL;

UPDATE inventory.stock_movements SET warehouse_id = 1;

-- ============================================
-- SCHEMA CHANGES: FUNCTIONS/PROCEDURES (CREATE, ALTER, DROP)
-- ============================================

-- Modify existing function
CREATE OR REPLACE FUNCTION public.get_customer_order_total(p_customer_id INTEGER)
RETURNS DECIMAL(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total DECIMAL(12,2);
BEGIN
    -- Modified: Only count delivered and shipped orders
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total
    FROM public.orders
    WHERE customer_id = p_customer_id
      AND status IN ('delivered', 'shipped');

    RETURN v_total;
END;
$$;

-- CREATE new functions
CREATE OR REPLACE FUNCTION public.get_product_average_rating(p_product_id INTEGER)
RETURNS DECIMAL(3,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_avg DECIMAL(3,2);
BEGIN
    SELECT COALESCE(AVG(rating), 0)
    INTO v_avg
    FROM public.product_reviews
    WHERE product_id = p_product_id;

    RETURN v_avg;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_category_product_count(p_category_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.products
    WHERE category_id = p_category_id;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION inventory.get_product_stock_level(p_product_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_in INTEGER;
    v_out INTEGER;
BEGIN
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_in
    FROM inventory.stock_movements
    WHERE product_id = p_product_id AND movement_type = 'IN';

    SELECT COALESCE(SUM(quantity), 0)
    INTO v_out
    FROM inventory.stock_movements
    WHERE product_id = p_product_id AND movement_type = 'OUT';

    RETURN v_in - v_out;
END;
$$;

-- CREATE a procedure
CREATE OR REPLACE PROCEDURE public.update_customer_loyalty(
    p_customer_id INTEGER,
    p_points_to_add INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.customers
    SET loyalty_points = loyalty_points + p_points_to_add
    WHERE customer_id = p_customer_id;
END;
$$;

-- ============================================
-- SCHEMA CHANGES: VIEWS (CREATE)
-- ============================================

CREATE OR REPLACE VIEW public.v_product_summary AS
SELECT
    p.product_id,
    p.product_name,
    p.sku,
    c.category_name,
    s.supplier_name,
    p.unit_price,
    p.units_in_stock,
    p.weight_kg,
    COALESCE(
        (SELECT AVG(r.rating) FROM public.product_reviews r WHERE r.product_id = p.product_id),
        0
    ) as avg_rating,
    COALESCE(
        (SELECT COUNT(*) FROM public.product_reviews r WHERE r.product_id = p.product_id),
        0
    ) as review_count
FROM public.products p
JOIN public.categories c ON p.category_id = c.category_id
LEFT JOIN public.suppliers s ON p.supplier_id = s.supplier_id;

CREATE OR REPLACE VIEW public.v_customer_orders AS
SELECT
    c.customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    c.email,
    c.loyalty_points,
    COUNT(o.order_id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    MAX(o.order_date) as last_order_date
FROM public.customers c
LEFT JOIN public.orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.loyalty_points;

CREATE OR REPLACE VIEW inventory.v_stock_summary AS
SELECT
    p.product_id,
    p.product_name,
    p.units_in_stock as recorded_stock,
    COALESCE(SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END), 0) as total_in,
    COALESCE(SUM(CASE WHEN sm.movement_type = 'OUT' THEN sm.quantity ELSE 0 END), 0) as total_out,
    COALESCE(SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE -sm.quantity END), 0) as calculated_stock
FROM public.products p
LEFT JOIN inventory.stock_movements sm ON p.product_id = sm.product_id
GROUP BY p.product_id, p.product_name, p.units_in_stock;

-- ============================================
-- Summary of Changes Made (for reference when testing):
-- ============================================
--
-- =====================
-- DATA CHANGES BY LEVEL:
-- =====================
--
-- Level 0 (no FK):
--   categories: +2 INSERT, 1 UPDATE, 1 DELETE
--   suppliers: +2 INSERT, 1 UPDATE
--   customers: +3 INSERT, 1 UPDATE, 1 DELETE (Bob - cascades to orders/order_items)
--
-- Level 1 (FK to L0):
--   products: +4 INSERT, 2 UPDATE, 1 DELETE
--
-- Level 2 (FK to L1/L0):
--   orders: +3 INSERT, 1 UPDATE
--   order_items: +4 INSERT, 1 UPDATE
--
-- Level 3 (FK to L1):
--   stock_movements: +5 INSERT, 1 UPDATE, 1 DELETE
--
-- New tables with data:
--   product_reviews: +3 INSERT
--   customer_addresses: +3 INSERT
--   inventory.warehouses: +3 INSERT
--
-- =====================
-- SCHEMA CHANGES - COLUMNS:
-- =====================
--
-- ADD columns:
--   categories: display_order (INT), icon_url (VARCHAR), parent_category_id (INT)
--   suppliers: website (VARCHAR), is_preferred (BOOLEAN)
--   products: weight_kg (DECIMAL), sku (VARCHAR)
--   customers: date_of_birth (DATE), newsletter_subscribed (BOOLEAN)
--   orders: shipping_method (VARCHAR), tracking_number (VARCHAR)
--   order_items: notes (TEXT)
--   stock_movements: performed_by (VARCHAR), warehouse_id (INT)
--
-- DROP columns:
--   products: is_discontinued
--
-- ALTER column types:
--   suppliers.phone: VARCHAR(20) -> VARCHAR(30)
--   customers.phone: VARCHAR(20) -> VARCHAR(30)
--
-- ALTER column nullability:
--   products.weight_kg: SET NOT NULL
--
-- ALTER column defaults:
--   products.units_in_stock: SET DEFAULT 10
--   orders.status: SET DEFAULT 'new'
--   categories.is_active: DROP DEFAULT
--
-- =====================
-- SCHEMA CHANGES - INDEXES:
-- =====================
--
-- ADD indexes:
--   idx_categories_display_order ON categories(display_order)
--   idx_suppliers_rating ON suppliers(rating DESC)
--   idx_products_sku ON products(sku)
--   idx_products_price_stock ON products(unit_price, units_in_stock)
--   idx_customers_email_lower ON customers(LOWER(email)) -- expression index
--   idx_customers_loyalty ON customers(loyalty_points DESC)
--   idx_orders_status_date ON orders(status, order_date)
--   idx_products_sku_unique ON products(sku) WHERE sku IS NOT NULL -- partial unique
--   idx_reviews_product, idx_reviews_customer, idx_reviews_rating (new table)
--   idx_addresses_customer, idx_addresses_default (new table)
--
-- DROP indexes:
--   idx_products_category
--   idx_orders_date
--
-- =====================
-- SCHEMA CHANGES - FOREIGN KEYS:
-- =====================
--
-- DROP FK:
--   fk_orderitem_product (ON DELETE RESTRICT)
--
-- ADD FK:
--   fk_orderitem_product_cascade (ON DELETE CASCADE ON UPDATE CASCADE)
--   fk_category_parent (self-referential on categories)
--   fk_movements_warehouse (stock_movements -> warehouses)
--   (plus FKs on new tables: product_reviews, customer_addresses)
--
-- =====================
-- SCHEMA CHANGES - CHECK CONSTRAINTS:
-- =====================
--
-- ADD constraints:
--   chk_products_price_positive: unit_price >= 0
--   chk_products_stock_non_negative: units_in_stock >= 0
--   chk_suppliers_rating_range: rating >= 0 AND rating <= 5
--   chk_orders_valid_status: status IN ('new', 'pending', ...)
--   chk_orderitems_quantity_positive: quantity > 0
--   chk_orderitems_discount_range: discount >= 0 AND discount <= unit_price
--   (plus CHECK constraints on new tables)
--
-- =====================
-- SCHEMA CHANGES - TABLES:
-- =====================
--
-- CREATE tables:
--   public.product_reviews (with FK to products, customers)
--   public.customer_addresses (with FK to customers)
--   inventory.warehouses
--
-- =====================
-- SCHEMA CHANGES - FUNCTIONS/PROCEDURES:
-- =====================
--
-- ALTER function:
--   get_customer_order_total (modified logic)
--
-- CREATE functions:
--   public.get_product_average_rating
--   public.get_category_product_count
--   inventory.get_product_stock_level
--
-- CREATE procedure:
--   public.update_customer_loyalty
--
-- =====================
-- SCHEMA CHANGES - VIEWS:
-- =====================
--
-- CREATE views:
--   public.v_product_summary
--   public.v_customer_orders
--   inventory.v_stock_summary
--
-- =====================
-- TESTING NOTES:
-- =====================
--
-- TIMESTAMP TESTING:
--   All new records use explicit '2024-01-01 10:00:00' or '2024-02-XX' timestamps
--   to ensure timestamp comparison precision is working correctly.
--
-- FK ORDERING TEST:
--   When ContextFreeSQL reverts these changes, it must:
--   1. DROP new tables (product_reviews, customer_addresses, warehouses)
--   2. DROP new views
--   3. DROP new functions/procedures
--   4. DELETE data: order_items -> orders -> products/stock_movements -> categories/suppliers/customers
--   5. Restore schema: FKs, indexes, columns, constraints
--   6. INSERT data in reverse FK order
--
-- COMBINED SCHEMA + DATA TEST:
--   Tables with BOTH schema and data changes:
--   - categories (new columns + data INSERT/UPDATE/DELETE)
--   - suppliers (new columns + data INSERT/UPDATE)
--   - customers (new columns + data INSERT/UPDATE/DELETE)
--   - products (new columns, dropped column + data INSERT/UPDATE/DELETE)
--   - orders (new columns + data INSERT/UPDATE)
--   - order_items (new column, FK change + data INSERT/UPDATE)
--   - stock_movements (new columns, new FK + data INSERT/UPDATE/DELETE)
--
-- ============================================
