DO $$
BEGIN

    ALTER TABLE IF EXISTS collateral.collateral_receivables_warehouse_receipt
    DROP COLUMN IF EXISTS commodity_type_lookup,
    DROP COLUMN IF EXISTS no_of_bushels,
    DROP COLUMN IF EXISTS no_of_pounds,
    DROP COLUMN IF EXISTS issue_date,
    DROP COLUMN IF EXISTS received_date,
    DROP COLUMN IF EXISTS possession_verified,
    DROP COLUMN IF EXISTS released_to,
    DROP COLUMN IF EXISTS return_method_lookup;

      --the warehouse paper reciept table, with fields we just removed from the parent, 'warehouse receipt' table
  CREATE TABLE collateral.collateral_receivables_warehouse_paper_receipt (
      collateral_receivables_warehouse_paper_receipt_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      collateral_receivables_warehouse_receipt_id INTEGER NOT NULL,
      customer_id VARCHAR(64) NOT NULL,
      commodity_type_lookup INTEGER,
      no_of_bushels INTEGER,
      no_of_pounds INTEGER,
      issue_date TIMESTAMPTZ,
      received_date TIMESTAMPTZ,
      possession_verified BOOLEAN,
      released_to VARCHAR(64),
      return_method_lookup INTEGER,
      certificate_number CHARACTER VARYING(64),
      paper_record_status_lookup_id INTEGER,
      paper_record_release_date TIMESTAMPTZ,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_by CHARACTER VARYING(64) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE,
      updated_by CHARACTER VARYING(64),
      deleted_at TIMESTAMP WITH TIME ZONE,
      deleted_by CHARACTER VARYING(64),
      text_search_vector_weighted TSVECTOR,
      
      CONSTRAINT fk_warehouse_paper_receipt
          FOREIGN KEY (collateral_receivables_warehouse_receipt_id)
          REFERENCES collateral.collateral_receivables_warehouse_receipt (collateral_receivables_warehouse_receipt_id)
          ON DELETE CASCADE
  );

  ALTER TABLE collateral.collateral_receivables_warehouse_paper_receipt ADD CONSTRAINT fk__collateral_warehouse_paper_receipt__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;

  -- Add index for faster lookups
  CREATE INDEX idx_warehouse_paper_receipt_id ON collateral.collateral_receivables_warehouse_paper_receipt (collateral_receivables_warehouse_paper_receipt_id);
  CREATE INDEX idx__warehouse__paper_receipt ON collateral.collateral_receivables_warehouse_paper_receipt (customer_id);


-- WarehousePaperReceiptStatus = 44
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Active', 1, 44, 1, NULL),
  ('Pending Release', 2, 44, 2, NULL),
  ('Released', 3, 44, 3, NULL);

END $$;