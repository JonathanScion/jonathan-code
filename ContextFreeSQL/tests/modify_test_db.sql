-- ============================================
-- Test Database Modification Script for ContextFreeSQL
-- Run this AFTER setup_test_db.sql to create differences
-- ============================================

-- ============================================
-- SCHEMA CHANGES
-- ============================================

-- 1. Add a new column to categories
ALTER TABLE public.categories
ADD COLUMN display_order INTEGER DEFAULT 0;

-- 2. Drop a column from suppliers
ALTER TABLE public.suppliers
DROP COLUMN phone;

-- 3. Modify column type (make description longer in categories)
ALTER TABLE public.categories
ALTER COLUMN description TYPE VARCHAR(500);

-- 4. Add NOT NULL constraint with default
ALTER TABLE public.products
ALTER COLUMN units_in_stock SET NOT NULL;

-- 5. Change default value
ALTER TABLE public.orders
ALTER COLUMN status SET DEFAULT 'new';

-- 6. Drop an index
DROP INDEX IF EXISTS idx_products_supplier;

-- 7. Add a new index
CREATE INDEX idx_products_price ON public.products(unit_price);

-- 8. Add a new unique constraint
ALTER TABLE public.suppliers
ADD CONSTRAINT uq_supplier_name UNIQUE (supplier_name);

-- ============================================
-- NEW TABLE
-- ============================================

-- 9. Add a completely new table
CREATE TABLE public.product_reviews (
    review_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT false,
    CONSTRAINT fk_review_product FOREIGN KEY (product_id)
        REFERENCES public.products(product_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_customer FOREIGN KEY (customer_id)
        REFERENCES public.customers(customer_id) ON DELETE CASCADE
);

CREATE INDEX idx_reviews_product ON public.product_reviews(product_id);

-- ============================================
-- DROP TABLE
-- ============================================

-- 10. Drop stock_movements table (and its schema if empty)
DROP TABLE IF EXISTS inventory.stock_movements;

-- ============================================
-- FOREIGN KEY CHANGES
-- ============================================

-- 11. Drop a foreign key
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS fk_product_supplier;

-- 12. Add a new foreign key with different behavior
ALTER TABLE public.products
ADD CONSTRAINT fk_product_supplier FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers(supplier_id) ON DELETE CASCADE;

-- ============================================
-- DATA CHANGES
-- ============================================

-- 13. Insert new records
INSERT INTO public.categories (category_name, description, is_active, display_order) VALUES
('Sports & Outdoors', 'Sporting goods and outdoor equipment', true, 5);

INSERT INTO public.suppliers (supplier_name, contact_email, address, rating) VALUES
('Outdoor Gear Co.', 'info@outdoorgear.com', '321 Adventure Way, Denver, CO', 4.75);

INSERT INTO public.customers (first_name, last_name, email, loyalty_points) VALUES
('Charlie', 'Brown', 'charlie.b@email.com', 50);

-- 14. Update existing records
UPDATE public.categories
SET description = 'Updated: Electronic devices, gadgets, and accessories',
    display_order = 1
WHERE category_name = 'Electronics';

UPDATE public.categories
SET display_order = 2
WHERE category_name = 'Books';

UPDATE public.categories
SET display_order = 3
WHERE category_name = 'Clothing';

UPDATE public.suppliers
SET rating = 4.80,
    address = '123 Tech Park Drive, Silicon Valley, CA 94000'
WHERE supplier_name = 'TechCorp Inc.';

UPDATE public.products
SET unit_price = 34.99,
    units_in_stock = 175
WHERE product_name = 'Wireless Mouse';

UPDATE public.customers
SET loyalty_points = 300,
    email = 'john.smith.updated@email.com'
WHERE first_name = 'John' AND last_name = 'Smith';

-- 15. Delete records
DELETE FROM public.products
WHERE product_name = 'Vintage Keyboard';

DELETE FROM public.categories
WHERE category_name = 'Home & Garden';

-- 16. Insert new products (including one for the new category)
INSERT INTO public.products (product_name, category_id, supplier_id, unit_price, units_in_stock, is_discontinued)
SELECT 'Bluetooth Headphones', c.category_id, s.supplier_id, 79.99, 60, false
FROM public.categories c, public.suppliers s
WHERE c.category_name = 'Electronics' AND s.supplier_name = 'TechCorp Inc.';

INSERT INTO public.products (product_name, category_id, supplier_id, unit_price, units_in_stock, is_discontinued)
SELECT 'Camping Tent', c.category_id, s.supplier_id, 149.99, 30, false
FROM public.categories c, public.suppliers s
WHERE c.category_name = 'Sports & Outdoors' AND s.supplier_name = 'Outdoor Gear Co.';

-- 17. Add some reviews for the new table
INSERT INTO public.product_reviews (product_id, customer_id, rating, review_text, is_verified)
SELECT p.product_id, c.customer_id, 5, 'Excellent mouse, very responsive!', true
FROM public.products p, public.customers c
WHERE p.product_name = 'Wireless Mouse' AND c.email LIKE 'john.smith%';

INSERT INTO public.product_reviews (product_id, customer_id, rating, review_text, is_verified)
SELECT p.product_id, c.customer_id, 4, 'Great book for learning SQL.', true
FROM public.products p, public.customers c
WHERE p.product_name = 'SQL Mastery Book' AND c.first_name = 'Jane';

-- ============================================
-- FUNCTION CHANGES
-- ============================================

-- 18. Modify existing function (change logic)
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

-- 19. Add a new function
CREATE OR REPLACE FUNCTION public.get_product_review_avg(p_product_id INTEGER)
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

-- ============================================
-- ORDER DATA CHANGES
-- ============================================

-- 20. Add new orders and items
INSERT INTO public.orders (customer_id, order_date, ship_date, status, total_amount, notes)
SELECT c.customer_id, '2024-02-01', '2024-02-03', 'delivered', 79.99, 'New headphones order'
FROM public.customers c WHERE c.first_name = 'Alice';

INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, discount)
SELECT o.order_id, p.product_id, 1, 79.99, 0.00
FROM public.orders o
JOIN public.customers c ON o.customer_id = c.customer_id
JOIN public.products p ON p.product_name = 'Bluetooth Headphones'
WHERE c.first_name = 'Alice' AND o.order_date = '2024-02-01';

-- Update order status
UPDATE public.orders
SET status = 'delivered',
    ship_date = '2024-01-22'
WHERE order_id = 3;

-- ============================================
-- Summary of Changes Made:
-- ============================================
-- Schema Changes:
--   - Added column: categories.display_order
--   - Dropped column: suppliers.phone
--   - Modified type: categories.description (TEXT -> VARCHAR(500))
--   - Added NOT NULL: products.units_in_stock
--   - Changed default: orders.status ('pending' -> 'new')
--   - Dropped index: idx_products_supplier
--   - Added index: idx_products_price
--   - Added constraint: uq_supplier_name
--   - Added table: product_reviews
--   - Dropped table: inventory.stock_movements
--   - Modified FK: fk_product_supplier (ON DELETE behavior)
--
-- Data Changes:
--   - Added: 1 category, 1 supplier, 1 customer, 2 products, 2 reviews, 1 order
--   - Updated: categories, suppliers, products, customers, orders
--   - Deleted: 1 product (Vintage Keyboard), 1 category (Home & Garden)
--
-- Function Changes:
--   - Modified: get_customer_order_total (added status filter)
--   - Added: get_product_review_avg
-- ============================================
