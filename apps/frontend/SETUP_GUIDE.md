# DefiCredit Frontend - Setup & Development Guide

## Prerequisites

- **Node.js** 18.17 or later
- **npm** 9+ or **yarn** 4+
- **Git** for version control

## Installation

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

This will install:
- Next.js 14.2.5 and React 18.3.1
- Tailwind CSS 3.4.7 and PostCSS
- Lucide React icons (414+ icons)
- TypeScript 5 and type definitions

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Configure for your backend:

```env
# .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_IOTA_NETWORK=testnet
```

Available networks: `testnet`, `mainnet` (for future)

## Development

### Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Hot Reload**: Enabled (changes auto-refresh)

### Development Workflow

1. **Edit components**: All changes in `src/` are hot-reloaded
2. **Tailwind compilation**: Automatic in dev mode
3. **TypeScript checking**: Background compilation
4. **API calls**: Make requests to backend at configured URL

### Useful Commands

```bash
# Type check without building
npx tsc --noEmit

# Lint (if configured)
npm run lint

# Format code (if Prettier configured)
npx prettier --write src/

# Build for production
npm run build

# Start production server (local testing)
npm run start
```

## File Structure Quick Reference

### Core App Files
```
src/app/
  ├── layout.tsx          # Root layout, metadata
  ├── page.tsx            # Main entry (role router)
  └── globals.css         # Global styles
```

### Components (Functional)

**Landing Page**
```
src/components/
  └── LandingPage.tsx     # Hero + role selection
```

**Borrower Flow** (4 Steps)
```
src/components/borrower/
  ├── BorrowerFlow.tsx                # State manager
  ├── DIDLoginStep.tsx                # Step 1: Connect wallet
  ├── ConsentScoreStep.tsx            # Step 2: Risk scoring
  ├── MarketplaceStep.tsx             # Step 3: Pool selection + loan request
  └── LoanConfirmationStep.tsx        # Step 4: Confirmation
```

**Lender Flow** (Dashboard)
```
src/components/lender/
  ├── LenderFlow.tsx                  # Auth entry
  └── LenderDashboard.tsx             # Pool mgmt + loan approval
```

**Reusable UI Components**
```
src/components/ui/
  ├── Button.tsx                      # Variants: primary, secondary, ghost, danger, success
  ├── Card.tsx                        # Container with glass effect
  ├── Badge.tsx                       # Colored tags
  └── StepIndicator.tsx               # Progress indicator
```

### Libraries

```
src/lib/
  ├── api.ts              # Backend API client (all routes)
  ├── wallet.ts           # Wallet integration (stub, replace with real)
  └── utils.ts            # Utility functions (formatters, color getters, etc.)
```

## Key Features

### Landing Page
- Hero section with gradient text
- Role selection cards (Borrower / Lender)
- Feature grid (4 cards)
- Responsive navbar with testnet badge

### Borrower Portal (4-Step Flow)

**Step 1: DID Login**
- Wallet connection UI
- Display DID (Decentralized Identifier)
- Display wallet address

**Step 2: Consent & Risk Scoring**
- Grant data consent (banking, billing, repayment history)
- Call `/api/score` to compute risk score
- Display composite score (0-100) + risk band (A/B/C/D)
- Show individual metric breakdown
- Issue Verifiable Credential (VC)
- Display VC hash

**Step 3: Marketplace**
- Load eligible pools (filtered by score/band)
- Display pool cards with APR, liquidity, min score
- Select pool to apply
- Enter loan amount (IOTA nanos)
- Show interest calculation
- Submit loan request with VC attached

**Step 4: Confirmation**
- Show loan request success
- Display loan position NFT card
- Show transaction hash (copy-able)
- Provide next steps information

### Lender Portal (Dashboard)

**Authentication**
- Connect wallet as lender
- Display lender DID and address

**Pool Management**
- Tab-based pool selection
- Display pool stats (available liquidity, APR, utilization %)

**Loan Review**
- List pending loan requests for selected pool
- Show borrower DID, address, loan amount
- Display risk score with color-coded bar
- Expand VC metadata (issuer, dates, hash)
- Approve & Fund button (signs + submits TX)
- Reject button (dismisses request)

## Styling System

### Tailwind CSS

All styling is utility-based:

```tsx
// Example: Button with hover effect
<button className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all duration-200">
  Click me
</button>
```

### Custom CSS

Glassmorphism, gradients, and animations in `src/app/globals.css`:

```css
.glass-card {
  background: rgba(26, 39, 68, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(45, 62, 95, 0.6);
}

.gradient-text {
  background: linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Color Tokens

```typescript
// Navy palette (backgrounds)
bg-[#0F1729]    // Very dark navy
bg-[#1A2744]    // Card backgrounds
bg-[#243154]    // Elevated cards
bg-[#2D3E5F]    // Borders

// Primary text
text-[#E2E8F0]  // Primary (light gray-blue)
text-[#94A3B8]  // Secondary (muted)

// Accent colors
bg-indigo-600   // Primary CTA
bg-emerald-500  // Success states
bg-amber-500    // Warnings
bg-rose-500     // Errors/Rejections
```

## API Integration

All API calls go through `src/lib/api.ts`:

### Example Usage

```typescript
import { api } from "@/lib/api";

// Get risk score
const scoreData = await api.score(borrowerDid);
console.log(scoreData.score, scoreData.risk_band);

// Get eligible pools
const pools = await api.eligiblePools(score, riskBand);
pools.forEach(pool => console.log(pool.name, pool.apr_percent));

// Request loan
const loanResult = await api.requestLoan({
  borrower_did: wallet.did,
  borrower_address: wallet.address,
  pool_id: pool.pool_id,
  principal: 50000,
});
```

### API Response Types

All responses are fully typed:

```typescript
interface ScoreResponse {
  score: number;
  risk_band: string;
  metrics: Record<string, number>;
  composite_breakdown: Record<string, number>;
}

interface Pool {
  pool_id: string;
  name: string;
  apr_percent: string;
  interest_rate_bps: number;
  available_liquidity: string;
  // ... more fields
}
```

## Wallet Integration (Mock)

Currently using mock wallet in `src/lib/wallet.ts`.

### Mock Wallets

```typescript
MOCK_WALLETS = {
  borrower: {
    address: "0xa3f7b2c89d4e1f0612345678901234567890abcd",
    did: "did:iota:tst:0xa3f7b2c89d4e1f0612345678901234567890abcd",
  },
  lender: {
    address: "0xb4e8c3d90a5f2e1723456789012345678901bcde",
    did: "did:iota:tst:0xb4e8c3d90a5f2e1723456789012345678901bcde",
  },
};
```

### For Production Integration

Replace with real wallet:

```typescript
// Option 1: IOTA dApp Kit (recommended)
import { useWallet } from "@iota/dapp-kit";

// Option 2: IOTA Wallet Standard
import { wallet } from "@iota/wallet-standard";

// Option 3: Custom wallet integration
// Implement `connectWallet()` and `signAndSubmitTx()` functions
```

## Building for Production

### Build Command

```bash
npm run build
```

This will:
1. Compile TypeScript
2. Bundle and optimize React components
3. Generate static pages
4. Create `.next/` directory

### Output

```
.next/
  ├── server/           # Server-side code
  ├── static/           # Static assets
  └── ...
```

### Production Deployment

```bash
# Local test
npm run start
# Open http://localhost:3000

# Deploy to Vercel (recommended for Next.js)
vercel

# Or manual deployment
# Upload contents of .next/ and public/ to your server
```

## Troubleshooting

### Port 3000 Already in Use

```bash
# Use different port
npm run dev -- -p 3001
```

### Hot reload not working

1. Check file paths in imports
2. Restart dev server: `Ctrl+C` then `npm run dev`
3. Clear `.next/` folder: `rm -rf .next && npm run dev`

### TypeScript errors in editor

```bash
# Rebuild TypeScript cache
npx tsc --noEmit
```

### API calls failing

Check:
1. Backend is running at `NEXT_PUBLIC_BACKEND_URL`
2. CORS is enabled on backend
3. API endpoints match expected paths (`/api/score`, `/api/pools`, etc.)

### Styling not applying

1. Check Tailwind config: `tailwind.config.ts`
2. Verify `globals.css` is imported in `layout.tsx`
3. Clear cache: `rm -rf .next node_modules && npm install`

## Performance Tips

### Development
- Keep dev server running for hot reload
- Use Browser DevTools for debugging
- Monitor performance in Network tab

### Production
- Run `npm run build` before deploying
- Test with `npm run start`
- Use Next.js Image component for images (future)
- Consider caching strategies for API calls

## Browser Support

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [IOTA Documentation](https://docs.iota.org)

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Test thoroughly
4. Commit: `git commit -m "Add feature description"`
5. Push: `git push origin feature/your-feature`
6. Create Pull Request

## License

Copyright 2024 DefiCredit. All rights reserved.
