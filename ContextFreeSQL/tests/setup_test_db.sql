-- ============================================
-- Test Database Setup Script for ContextFreeSQL
-- Run this on a blank PostgreSQL database first
-- ============================================

-- Create a custom schema for organization
CREATE SCHEMA IF NOT EXISTS inventory;

-- ============================================
-- Table: categories (no dependencies)
-- ============================================
CREATE TABLE public.categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: suppliers (no dependencies)
-- ============================================
CREATE TABLE public.suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: products (depends on categories, suppliers)
-- ============================================
CREATE TABLE public.products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    category_id INTEGER NOT NULL,
    supplier_id INTEGER,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    units_in_stock INTEGER DEFAULT 0,
    is_discontinued BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_category FOREIGN KEY (category_id)
        REFERENCES public.categories(category_id) ON DELETE RESTRICT,
    CONSTRAINT fk_product_supplier FOREIGN KEY (supplier_id)
        REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL
);

-- Index on products for common queries
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_supplier ON public.products(supplier_id);

-- ============================================
-- Table: customers (no dependencies)
-- ============================================
CREATE TABLE public.customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    loyalty_points INTEGER DEFAULT 0,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: orders (depends on customers)
-- ============================================
CREATE TABLE public.orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ship_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    notes TEXT,
    CONSTRAINT fk_order_customer FOREIGN KEY (customer_id)
        REFERENCES public.customers(customer_id) ON DELETE CASCADE
);

CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_date ON public.orders(order_date);

-- ============================================
-- Table: order_items (depends on orders, products)
-- ============================================
CREATE TABLE public.order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(5,2) DEFAULT 0.00,
    CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id)
        REFERENCES public.orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_orderitem_product FOREIGN KEY (product_id)
        REFERENCES public.products(product_id) ON DELETE RESTRICT
);

CREATE INDEX idx_orderitems_order ON public.order_items(order_id);
CREATE INDEX idx_orderitems_product ON public.order_items(product_id);

-- ============================================
-- Table: inventory.stock_movements (in separate schema)
-- ============================================
CREATE TABLE inventory.stock_movements (
    movement_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    movement_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT'
    quantity INTEGER NOT NULL,
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reference_note VARCHAR(200),
    CONSTRAINT fk_movement_product FOREIGN KEY (product_id)
        REFERENCES public.products(product_id) ON DELETE CASCADE
);

-- ============================================
-- Insert Sample Data
-- ============================================

-- Categories (using explicit timestamps for reproducible testing)
INSERT INTO public.categories (category_name, description, is_active, created_at) VALUES
('Electronics', 'Electronic devices and accessories', true, '2024-01-01 10:00:00'),
('Books', 'Physical and digital books', true, '2024-01-01 10:00:00'),
('Clothing', 'Apparel and fashion items', true, '2024-01-01 10:00:00'),
('Home & Garden', 'Home improvement and garden supplies', false, '2024-01-01 10:00:00');

-- Suppliers (using explicit timestamps for reproducible testing)
INSERT INTO public.suppliers (supplier_name, contact_email, phone, address, rating, created_at) VALUES
('TechCorp Inc.', 'sales@techcorp.com', '555-0101', '123 Tech Street, Silicon Valley, CA', 4.50, '2024-01-01 10:00:00'),
('BookWorld Publishers', 'orders@bookworld.com', '555-0102', '456 Library Ave, Boston, MA', 4.25, '2024-01-01 10:00:00'),
('Fashion Forward LLC', 'contact@fashionforward.com', '555-0103', '789 Style Blvd, New York, NY', 3.80, '2024-01-01 10:00:00');

-- Products (using explicit timestamps for reproducible testing)
INSERT INTO public.products (product_name, category_id, supplier_id, unit_price, units_in_stock, is_discontinued, created_at) VALUES
('Wireless Mouse', 1, 1, 29.99, 150, false, '2024-01-01 10:00:00'),
('USB-C Hub', 1, 1, 49.99, 75, false, '2024-01-01 10:00:00'),
('Programming Guide', 2, 2, 39.99, 200, false, '2024-01-01 10:00:00'),
('SQL Mastery Book', 2, 2, 44.99, 120, false, '2024-01-01 10:00:00'),
('Cotton T-Shirt', 3, 3, 19.99, 500, false, '2024-01-01 10:00:00'),
('Vintage Keyboard', 1, 1, 89.99, 25, true, '2024-01-01 10:00:00');

-- Customers (using explicit timestamps for reproducible testing)
INSERT INTO public.customers (first_name, last_name, email, phone, loyalty_points, registered_at) VALUES
('John', 'Smith', 'john.smith@email.com', '555-1001', 250, '2024-01-01 10:00:00'),
('Jane', 'Doe', 'jane.doe@email.com', '555-1002', 500, '2024-01-01 10:00:00'),
('Bob', 'Johnson', 'bob.j@email.com', '555-1003', 100, '2024-01-01 10:00:00'),
('Alice', 'Williams', 'alice.w@email.com', '555-1004', 750, '2024-01-01 10:00:00');

-- Orders
INSERT INTO public.orders (customer_id, order_date, ship_date, status, total_amount, notes) VALUES
(1, '2024-01-15', '2024-01-17', 'shipped', 79.98, 'Express shipping requested'),
(2, '2024-01-16', '2024-01-18', 'delivered', 44.99, NULL),
(1, '2024-01-20', NULL, 'pending', 69.98, 'Gift wrapping needed'),
(3, '2024-01-21', '2024-01-23', 'shipped', 29.99, NULL);

-- Order Items
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, discount) VALUES
(1, 1, 2, 29.99, 0.00),
(1, 2, 1, 49.99, 10.00),
(2, 4, 1, 44.99, 0.00),
(3, 3, 1, 39.99, 0.00),
(3, 1, 1, 29.99, 0.00),
(4, 1, 1, 29.99, 0.00);

-- Stock Movements (using explicit timestamps for reproducible testing)
INSERT INTO inventory.stock_movements (product_id, movement_type, quantity, reference_note, movement_date) VALUES
(1, 'IN', 200, 'Initial stock', '2024-01-01 10:00:00'),
(1, 'OUT', 50, 'January sales', '2024-01-15 10:00:00'),
(2, 'IN', 100, 'Initial stock', '2024-01-01 10:00:00'),
(2, 'OUT', 25, 'January sales', '2024-01-15 10:00:00'),
(3, 'IN', 250, 'Initial stock', '2024-01-01 10:00:00'),
(3, 'OUT', 50, 'January sales', '2024-01-15 10:00:00');

-- ============================================
-- Create a simple function for testing coded entities
-- ============================================
CREATE OR REPLACE FUNCTION public.get_customer_order_total(p_customer_id INTEGER)
RETURNS DECIMAL(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total
    FROM public.orders
    WHERE customer_id = p_customer_id;

    RETURN v_total;
END;
$$;

-- ============================================
-- Verification queries (optional - run to check data)
-- ============================================
-- SELECT 'categories' as tbl, COUNT(*) as cnt FROM public.categories
-- UNION ALL SELECT 'suppliers', COUNT(*) FROM public.suppliers
-- UNION ALL SELECT 'products', COUNT(*) FROM public.products
-- UNION ALL SELECT 'customers', COUNT(*) FROM public.customers
-- UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
-- UNION ALL SELECT 'order_items', COUNT(*) FROM public.order_items
-- UNION ALL SELECT 'stock_movements', COUNT(*) FROM inventory.stock_movements;
