# Chocolate pilot — capture kit (pre-production)

Status: **schema and protocol only**. This directory contains no collected observations and must not be interpreted as evidence or a started baseline.

## Files

- `trends-observations.template.csv`: one row per exported Google Trends series/term and time point, with query settings repeated for auditability.
- `retail-observations.template.csv`: one row per product × retailer/location × observation time.
- `review-protocol.md`: evidence, quality and interpretation rules.

## Activation gates

1. Trends CSV exported manually from the official interface and original file retained; record export timestamp and exact settings.
2. Retail data obtained from a source whose access, license, retention and commercial use are explicitly permitted.
3. Product matching validated by EAN, net weight and variant.
4. Review rejects missing provenance, ambiguous timestamps, duplicate records and unsupported shopper claims.
5. Four-week baseline starts only after the first authorized, reproducible capture is accepted.

No scraper, credentials, external API calls, production writes or recurring capture are included in this kit.
