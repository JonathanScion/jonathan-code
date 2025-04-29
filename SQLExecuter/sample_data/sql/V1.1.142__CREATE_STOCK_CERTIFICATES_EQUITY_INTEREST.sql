DO $$
BEGIN

  --stock----------------
  --drop the columns from the parent stock table
  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS issuer_name;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS certificate_number;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS certificated;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS in_possession;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS percentage_outstanding_shares;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS number_of_shares;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS power_document;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS pledge_agreement;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS released_to;

  ALTER TABLE collateral.collateral_cash_investments_stock DROP COLUMN IF EXISTS return_method_lookup;

  --the stock certificate table, with fields we just removed from the parent, 'stocks' table
  CREATE TABLE collateral.collateral_cash_investments_stock_certificate (
      collateral_cash_investments_stock_certificate_id SERIAL PRIMARY KEY,
      collateral_cash_investments_stock_id INTEGER NOT NULL,
      issuer_name CHARACTER VARYING(64),
      issuer_type CHARACTER VARYING(64),
      certificate_number CHARACTER VARYING(64),
      certificated BOOLEAN,
      in_possession BOOLEAN,
      percentage_outstanding_shares NUMERIC,
      number_of_shares INTEGER,
      power_document BOOLEAN,
      pledge_agreement BOOLEAN,
      stock_certificate_status CHARACTER VARYING(64),
      stock_certificate_record_release_date DATE,
      released_to CHARACTER VARYING(64),
      return_method_lookup INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_by CHARACTER VARYING(64) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE,
      updated_by CHARACTER VARYING(64),
      deleted_at TIMESTAMP WITH TIME ZONE,
      deleted_by CHARACTER VARYING(64),
      text_search_vector_weighted TSVECTOR,
      
      CONSTRAINT fk_stock
          FOREIGN KEY (collateral_cash_investments_stock_id)
          REFERENCES collateral.collateral_cash_investments_stock (collateral_cash_investments_stock_id)
          ON DELETE CASCADE
  );

  -- Add index for faster lookups
  CREATE INDEX idx_certificates_stock_id ON collateral.collateral_cash_investments_stock_certificate (collateral_cash_investments_stock_id);

  --equity----------------
  --drop the columns from the parent equity non cobank table
  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS issuer_name;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS certificate_number;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS certificated;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS in_possession;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS percentage_outstanding_shares;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS number_of_shares;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS power_document;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS pledge_agreement;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS released_to;

  ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank DROP COLUMN IF EXISTS return_method_lookup;

  --the equity interest table, with fields we just removed from the parent, 'equity non cobank' table
  CREATE TABLE collateral.collateral_cash_investments_equity_non_cobank_interest (
      collateral_cash_investments_equity_non_cobank_interest_id SERIAL PRIMARY KEY,
      collateral_cash_investments_equity_non_cobank_id INTEGER NOT NULL,
      issuer_name CHARACTER VARYING(64),
      issuer_type CHARACTER VARYING(64),
      certificate_number CHARACTER VARYING(64),
      certificated BOOLEAN,
      in_possession BOOLEAN,
      percentage_outstanding_shares NUMERIC,
      number_of_shares INTEGER,
      power_document BOOLEAN,
      pledge_agreement BOOLEAN,
      equity_interest_status CHARACTER VARYING(64),
      equity_interest_record_release_date DATE,
      released_to CHARACTER VARYING(64),
      return_method_lookup INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_by CHARACTER VARYING(64) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE,
      updated_by CHARACTER VARYING(64),
      deleted_at TIMESTAMP WITH TIME ZONE,
      deleted_by CHARACTER VARYING(64),
      text_search_vector_weighted TSVECTOR,
      
      CONSTRAINT fk_equity_non_cobank
          FOREIGN KEY (collateral_cash_investments_equity_non_cobank_id)
          REFERENCES collateral.collateral_cash_investments_equity_non_cobank (collateral_cash_investments_equity_non_cobank_id)
          ON DELETE CASCADE
  );

  -- Add index for faster lookups
  CREATE INDEX idx_equity_interest_equity_id ON collateral.collateral_cash_investments_equity_non_cobank_interest (collateral_cash_investments_equity_non_cobank_id);

END $$;