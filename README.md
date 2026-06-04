# HCT Institute Inventory Management

Responsive web-based inventory management system for HCT Institute simulation rooms, central supply, VR assets, requests, audit logs, QR labels, room reports, login/sign-up pages, and inventory transaction history.

## Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase-schema.sql`.
3. In `supabase-config.js`, set:
   - `url` to your Supabase project URL.
   - `anonKey` to your Supabase anon or publishable key.
4. Open `index.html` or deploy the folder to GitHub Pages.

## GitHub Pages

Push these files to a GitHub repository, then enable Pages from the repository settings. Use the repository root as the publishing source.

## Access Model

The app includes login and sign-up pages. When Supabase Auth email/password is enabled, those pages use Supabase Auth; otherwise they work as a local preview profile. It includes Viewer, Student/Staff, Room Custodian, Supply Officer, and Admin role controls in the interface. For strict enforcement, connect the same role model to account-based Supabase RLS policies.

## QR Codes and Reports

Room QR codes open the room inventory view. Item and VR QR codes open focused record pages. Each QR modal includes a print label action, and every room inventory page includes a print report action for that room.

## Data

The database starts empty. Preloaded healthcare equipment names are suggestions in the item dropdown only; they are not inserted as inventory records.
