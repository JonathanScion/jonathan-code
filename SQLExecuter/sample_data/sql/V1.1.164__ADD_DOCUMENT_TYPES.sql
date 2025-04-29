DO $$
BEGIN


-- remove any existing test data so that non null category id can be added
TRUNCATE TABLE collateral.customer_documents CASCADE;


-- Add document type category to document
ALTER TABLE collateral.customer_documents ADD COLUMN type_category_lookup_id SMALLINT NOT NULL;


-- DocumentTypeCategories = 46
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
    ('All', 1, 46, NULL, NULL),
    ('Real Estate - Site', 2, 46, NULL, NULL),
    ('Real Estate - Parcel', 3, 46, NULL, NULL),
    ('Fixture', 4, 46, NULL, NULL),
    ('Collateral', 5, 46, NULL, NULL),
    ('Collateral - Commodity Account', 6, 46, NULL, NULL),
    ('Collateral - Vehicle', 7, 46, NULL, NULL),
    ('Collateral - Equipment', 8, 46, NULL, NULL),
    ('Collateral - Trailer', 9, 46, NULL, NULL),
    ('Collateral - Equity (non-CoBank)', 10, 46, NULL, NULL),
    ('Collateral - Stock', 11, 46, NULL, NULL),
    ('Collateral - Letter of Credit', 12, 46, NULL, NULL),
    ('Collateral - Deposit Account', 13, 46, NULL, NULL),
    ('Collateral - Bond', 14, 46, NULL, NULL),
    ('Collateral - Pledged Note', 15, 46, NULL, NULL),
    ('Collateral - Custodianship Agreement', 16, 46, NULL, NULL),
    ('Collateral - Warehouse Receipt', 17, 46, NULL, NULL),
    ('Flood Zone Request', 18, 46, NULL, NULL),
    ('Flood Zone Determination', 19, 46, NULL, NULL),
    ('Bailee Agreement', 20, 46, NULL, NULL),
    ('Commitment', 21, 46, NULL, NULL),
    ('Insurance Policy', 22, 46, NULL, NULL),
    ('Title Perfection', 23, 46, NULL, NULL),
    ('Mortgage', 24, 46, NULL, NULL),
    ('UCC - Collateral', 25, 46, NULL, NULL),
    ('UCC - Asset', 26, 46, NULL, NULL),
    ('CDM', 27, 46, NULL, NULL)
;


-- This is possible to do these inserts below without repeating the subquery, but for readability we will repeat it.
-- VERY IMPORTANT WHEN WE DEAL WITH DOCUMENT TYPES, TO KEEP THINGS SIMPLE WE SHOULD KEEP THE VALUES UNIQUE ACROSS ALL CHILD TYPES AS THEY CAN OVERLAP

INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Agreement Collateral', 1, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46)),
    ('Indenture', 2, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46)),
    ('Inspection Report', 3, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46)),
    ('Letter', 4, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46)),
    ('Letter Extend (Post-Closing)', 5, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46)),
    ('Pooling, Marketing or Membership Agreements', 6, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46)),
    ('Security and Pledge Agreement', 7, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46)),
    ('Subordination Agreement', 8, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'All' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Opinion of Counsel', 9, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Site' AND type  = 46)),
    ('Ground Lease', 10, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Site' AND type  = 46)),
    ('Ground Lease and Assignment of Ground Leases', 11, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Site' AND type  = 46)),
    ('Appraisal', 12, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Site' AND type  = 46)),
    ('Environmental Checklist', 13, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Site' AND type  = 46)),
    ('Environmental Report', 14, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Site' AND type  = 46)),
    ('Survey', 15, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Site' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Tax Lien Search', 16, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Title Perfection' AND type  = 46)),
    ('Title Commitment', 17, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Title Perfection' AND type  = 46)),
    ('Title Document - Misc', 18, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Title Perfection' AND type  = 46)),
    ('Title Insurance', 19, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Title Perfection' AND type  = 46)),
    ('Title Opinion', 20, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Title Perfection' AND type  = 46)),
    ('Title Search/O&E', 21, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Title Perfection' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Plat Map', 22, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Parcel' AND type  = 46)),
    ('SHFA Property Schedule', 23, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Parcel' AND type  = 46)),
    ('Site Plan', 24, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Parcel' AND type  = 46)),
    ('Ground Lease', 25, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Parcel' AND type  = 46)),
    ('Ground Lease and Assignment of Ground Leases', 26, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Real Estate - Parcel' AND type  = 46))
;



INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Purchase Money Security Agreement (PMSI)', 27, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral' AND type  = 46)),
    ('Security Agreement', 28, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral' AND type  = 46))
; 


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Motor Vehicle Title', 29, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Vehicle' AND type  = 46)),
    ('Title/MSO', 30, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Vehicle' AND type  = 46))
; 


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Title/MSO', 31, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Equipment' AND type  = 46))
; 


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Commodity Account Control Agreement', 32, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Commodity Account' AND type  = 46)),
    ('Grain Storage Agreement', 33, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Commodity Account' AND type  = 46))
; 


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Deposit Control Agreement', 34, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Deposit Account' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Motor Vehicle Title', 35, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Trailer' AND type  = 46)),
    ('Title/MSO', 36, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Trailer' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Cancel Custodianship Agreement', 37, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Custodianship Agreement' AND type  = 46)),
    ('Custodianship Agreement', 38, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Custodianship Agreement' AND type  = 46)),
    ('Custodianship Transmittal Letter', 39, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Custodianship Agreement' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Stock Assignment Agreement', 40, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Equity (non-CoBank)' AND type  = 46)),
    ('Stock Document', 41, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Equity (non-CoBank)' AND type  = 46)),
    ('Equity Documents', 42, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Equity (non-CoBank)' AND type  = 46)),
    ('Pledge Agreement', 43, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Equity (non-CoBank)' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Stock Assignment Agreement', 44, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Stock' AND type  = 46)),
    ('Stock Document', 45, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Stock' AND type  = 46)),
    ('Equity Documents', 46, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Stock' AND type  = 46)),
    ('Pledge Agreement', 47, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Stock' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Letter of Credit (Collateral)', 48, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Letter of Credit' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Bond Document Collateral', 49, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Bond' AND type  = 46)),
    ('IRB Bond Documents', 50, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Bond' AND type  = 46)),
    ('IRB Lease Documents', 51, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Bond' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Allonge', 52, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Pledged Note' AND type  = 46)),
    ('Pledged Note', 53, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Pledged Note' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Warehouse Receipt', 54, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Collateral - Warehouse Receipt' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Assessor Information', 55, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Depreciated Schedule', 56, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Flood Zone Determination', 57, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Flood Zone Map', 58, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('FZD Blanket Borrower Notice (Trip Wire)', 59, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Letter of Map Amendment/Change', 60, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('FZD Letter 30 Day Reminder', 61, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('FZD Letter Forced Placement', 62, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('FZD Letter initial Notice - Inadequate Insurance - Map Change', 63, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('FZD Letter Map Change and Initial Force Placement', 64, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Plat Map', 65, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('SHFA Property Schedule', 66, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Site Plan', 67, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Broker Letter', 68, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Statement of Value', 69, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46)),
    ('Legal Description(s)', 70, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Flood Zone Determination' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Bailee Agreement', 71, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Bailee Agreement' AND type  = 46))
;



INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('FZD Letter 30 Day Reminder', 72, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Insurance Policy' AND type  = 46)),
    ('FZD Letter Forced Placement', 73, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Insurance Policy' AND type  = 46)),
    ('FZD Letter initial Notice - Inadequate Insurance - Map Change', 74, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Insurance Policy' AND type  = 46)),
    ('FZD Letter Map Change and Initial Force Placement', 75, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Insurance Policy' AND type  = 46)),
    ('Broker Letter', 76, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Insurance Policy' AND type  = 46)),
    ('Statement of Value', 77, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Insurance Policy' AND type  = 46)),
    ('Insurance Certificate', 78, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Insurance Policy' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('Central Utility Filing', 79, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Central Utility Filing - County Notice', 80, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Intercreditor Agreement', 81, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Landlord Consent', 82, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Landlord Waiver', 83, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Lease Documents pertaining to real property collateral', 84, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Mortgage', 85, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Mortgage Partial Release', 86, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Mortgage Full Release', 87, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Mortgage Amendment', 88, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Mortgage Amend and Restate', 89, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Organization Documents (Recorded)', 90, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Legal Description(s)', 91, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46)),
    ('Opinion of Counsel', 92, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'Mortgage' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('EFS - UCC-1 Financing Statement', 93, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('EFS - UCC-3 Amendment, Continuation, or Termination', 94, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('PPSA - 1 Financing Statement', 95, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('PPSA - Amendment, Continuation, or Termination', 96, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('Transmitting Utility - UCC-1 Financing Statement', 97, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('Transmitting Utility - UCC-3 Amendment, Continuation, or Termination', 98, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('UCC Lien Search', 99, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('UCC No Interest Release Letter', 100, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('UCC Pre-Authorization', 101, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('UCC Search to Reflect', 102, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('UCC-1 Financing Statement', 103, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('UCC-3 Amendment, Continuation, or Termination', 104, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46)),
    ('UCC-Title Report', 105, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Collateral' AND type  = 46))
;


INSERT INTO 
    collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES
    ('EFS - UCC-1 Financing Statement', 106, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Asset' AND type  = 46)),
    ('EFS - UCC-3 Amendment, Continuation, or Termination', 107, 46, NULL, (SELECT lookup_id FROM collateral.lookups WHERE label = 'UCC - Asset' AND type  = 46))
;


END $$;