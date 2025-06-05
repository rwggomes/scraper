# OpenEMR Puppeteer Automation

This project uses Puppeteer to automate interactions with the OpenEMR demo site.

## What it does

- Logs into OpenEMR with default credentials (`admin` / `pass`)
- Navigates to "Patient" > "New/Search"
- Accesses the correct iframe
- Clicks the `#search` button to trigger an empty patient search

## Requirements

- Node.js v18+
- npm
- Puppeteer

## Setup

```bash
npm install puppeteer
