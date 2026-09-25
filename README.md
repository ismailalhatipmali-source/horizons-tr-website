# HORIZONS TR Website

Official public website source for HORIZONS Eğitim Danışmanlık Turizm Emlakçılık Ticaret Limited Şirketi.

This repository contains the public company website only. It is connected to cPanel Git Version Control and deploys the contents of `dist/` to the live website directory through `.cpanel.yml`.

## Current Release

- Multilingual company website with 32 interface languages
- HORIZONS Arabic Level 1 launch/product section
- HORIZONS Smart App Builder section
- Future product catalogue placeholders
- Privacy, child-safety, terms, refunds, accessibility and support summaries
- Public update notice at `dist/updates/arabic-level-1.json`
- Apache `.htaccess` to prefer `index.html`, block directory indexes and route legacy language paths

## Deployment

From cPanel Git Version Control:

1. Open the repository connected to this GitHub project.
2. Use **Update from Remote**.
3. Use **Deploy HEAD Commit**.
4. Visit `https://horizons-tr.com/`.

The deployment file copies `dist/` into:

```text
/home2/horizonstr/public_html/
```

## Safety Rule

Do not place activation keys, private server packages, customer files, Gumroad credentials, payment secrets, product source vaults, or owner-only release archives in this repository.
