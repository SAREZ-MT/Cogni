-- Manual reversion (drizzle-kit has no `down` command). Drop order follows
-- FK dependency order: page_assets -> pages -> notebooks. Rows are gone
-- after this runs; there is no data preservation step (design.md).
drop table page_assets, pages, notebooks;
