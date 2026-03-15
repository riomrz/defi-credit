# DefiCredit Frontend Architecture

## Overview

DefiCredit Frontend is a Next.js 14 Client-Side Rendering (CSR) application for a decentralized credit marketplace on IOTA. The application enables borrowers to get risk-attested with verifiable credentials and apply for loans from multiple lending pools, while lenders can review requests and approve/reject loans.

## Project Structure

```
apps/frontend/
├── public/                          # Static assets
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout with metadata
│   │   ├── page.tsx                 # Main app entry (role router)
│   │   └── globals.css              # Global styles (Tailwind + custom)
│   ├── components/
│   │   ├── LandingPage.tsx          # Hero landing with role selection
│   │   ├── ui/                      # Reusable UI components
│   │   │   ├── Button.tsx           # Styled button with variants
│   │   │   ├── Card.tsx             # Card container with glass effect
│   │   │   ├── Badge.tsx            # Compact badge component
│   │   │   └── StepIndicator.tsx    # Multi-step progress indicator
│   │   ├── borrower/                # Borrower flow components
│   │   │   ├── BorrowerFlow.tsx     # Main borrower state manager (4 steps)
│   │   │   ├── DIDLoginStep.tsx     # Wallet connection
│   │   │   ├── ConsentScoreStep.tsx # Data consent + risk scoring
│   │   │   ├── MarketplaceStep.tsx  # Pool selection + loan request
│   │   │   └── LoanConfirmationStep.tsx # Confirmation receipt
│   │   └── lender/                  # Lender flow components
│   │       ├── LenderFlow.tsx       # Main lender entry + auth
│   │       └── LenderDashboard.tsx  # Pool dashboard + loan approval UI
│   └── lib/
│       ├── api.ts                   # Backend API client
│       ├── wallet.ts                # IOTA wallet integration (stub)
│       └── utils.ts                 # Utility functions (formatting, colors, etc.)
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.ts               # Tailwind CSS theme
├── postcss.config.mjs               # PostCSS pipeline
├── next.config.ts                   # Next.js configuration
├── .env.local.example               # Environment variables template
├── .gitignore                       # Git ignore rules
└── ARCHITECTURE.md                  # This file
```

## Key Technologies

- **Next.js 14**: React framework with built-in optimization
- **React 18**: UI library with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Radix UI**: Unstyled accessible components (foundation)
- **clsx + tailwind-merge**: Class utility helpers

## Color Palette

```typescript
// Deep Navy (backgrounds)
--bg-navy-900: #0F1729
--bg-navy-800: #1A2744
--bg-navy-700: #243154
--bg-navy-600: #2D3E5F

// Primary Accent
--accent-indigo: #6366F1

// Status Colors
--success: #06B6D4 / #10B981 (emerald)
--warning: #F59E0B (amber)
--error: #EF4444 (rose)
--info: #0EA5E9 (sky)

// Text
--text-primary: #E2E8F0
--text-secondary: #94A3B8
```

## Component Hierarchy

### Landing Page
```
LandingPage
  ├── Navbar (logo, testnet badge, IOTA link)
  ├── Hero Section
  │   ├── Badge (Live on IOTA Testnet)
  │   ├── Title + Gradient text
  │   ├── CTA Cards (Borrower / Lender)
  │   └── Feature Grid
  └── Footer
```

### Borrower Flow (4-Step Process)
```
BorrowerFlow (state manager)
  ├── Step 1: DIDLoginStep
  │   ├── Wallet connection UI
  │   ├── DID display
  │   └── Address display
  ├── Step 2: ConsentScoreStep
  │   ├── Data consent checkboxes
  │   ├── Risk score calculation
  │   ├── Metric bars
  │   └── VC issuance confirmation
  ├── Step 3: MarketplaceStep
  │   ├── Pool list (filtered by score/band)
  │   ├── Pool cards (APR, liquidity, stats)
  │   ├── Loan request form
  │   ├── Interest calculation
  │   └── TX submission
  └── Step 4: LoanConfirmationStep
      ├── Confirmation animation
      ├── NFT card (loan position)
      ├── Details summary
      ├── TX hash (copy-able)
      └── Next steps info
```

### Lender Flow
```
LenderFlow
  ├── DID authentication
  └── LenderDashboard
      ├── Pool tabs (selectable)
      ├── Pool stats (liquidity, APR, utilization)
      └── Loan List
          ├── Loan cards (ID, amount, borrower)
          ├── Risk score bar
          ├── VC metadata accordion
          └── Approve / Reject buttons
```

## State Management

**No global state manager** — Using React local state (`useState`). This is appropriate for a CSR application with isolated flows.

### BorrowerFlow State
```typescript
interface BorrowerState {
  wallet: WalletState | null;        // Connected wallet + DID
  score: number | null;              // Risk score (0-100)
  riskBand: string | null;           // A/B/C/D risk tier
  metrics: Record<string, number>;   // Individual metric scores
  vcHash: string | null;             // Issued VC hash
  selectedPoolId: string | null;     // Selected lending pool
  selectedPoolName: string | null;   // Pool display name
  loanRequestId: string | null;      // Created loan request ID
  loanTxHash: string | null;         // TX confirmation hash
  loanAmount: number;                // Requested loan amount
}
```

## API Integration

All API calls are made via `src/lib/api.ts`:

```typescript
// Scoring & VC Issuance
api.score(borrowerDid)
api.issueVC(borrowerDid)

// Pools
api.eligiblePools(score, riskBand)  // Filtered by borrower
api.allPools()                       // All available pools

// Loans
api.requestLoan(data)                // Borrower submits request
api.poolLoans(poolId)                // Lender fetches pending requests
api.fundLoan(data)                   // Lender approves + funds
api.repayLoan(data)                  // Borrower repays (future)
```

**Backend URL**: Set via `NEXT_PUBLIC_BACKEND_URL` env var (default: `http://localhost:3001`)

## Wallet Integration

Currently using mock wallet in `src/lib/wallet.ts`. For production:

1. Replace with `@iota/wallet-standard`
2. Or use `@iota/dapp-kit` for full Web3 integration
3. Implement real DID creation via IOTA Identity SDK

Mock addresses:
- **Borrower**: `0xa3f7b2c89d4e1f0612345678901234567890abcd`
- **Lender**: `0xb4e8c3d90a5f2e1723456789012345678901bcde`

## Styling Approach

### Tailwind + Custom CSS
- **Utility-first**: Most styling via Tailwind classes
- **Custom effects**: Glassmorphism, gradients, animations in `globals.css`
- **Dark mode**: Always active (`darkMode: ["class"]`)
- **Custom theme**: Navy palette extended in `tailwind.config.ts`

### Design Tokens
```css
/* Glass Card Effect */
.glass-card {
  background: rgba(26, 39, 68, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(45, 62, 95, 0.6);
}

/* Gradient Text */
.gradient-text {
  background: linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Glow Effect */
.glow-indigo {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
}
```

## Animations

Smooth transitions throughout:
- **fade-in**: 0.5s ease-in-out
- **slide-up**: 0.4s ease-out (from bottom)
- **shimmer**: 2s linear infinite (loading bars)
- **progress-fill**: 1s ease-in-out (metric bars)

## Accessibility

- Semantic HTML
- Form inputs with labels
- Icon + text combinations
- Color + icons for status (not color-only)
- Focus states on interactive elements
- Scrollbar customization for visibility

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_IOTA_NETWORK=testnet
```

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local

# Development server
npm run dev
# Open http://localhost:3000

# Build for production
npm run build
npm start
```

## TypeScript Strictness

- `strict: false` in tsconfig (allows gradual migration)
- Type imports for library types
- Explicit interface definitions for components
- Type guards in API responses

## Performance Considerations

- **CSR only**: No SSR/SSG (all client-side)
- **Code splitting**: Next.js automatic per-route
- **Image optimization**: Not in MVP (no Next/Image)
- **Bundle size**: Minimal dependencies, tree-shakeable

## Testing Strategy

Not included in MVP. Recommended for production:

1. **Unit tests**: Jest + React Testing Library
2. **Integration tests**: API mocking with MSW
3. **E2E tests**: Playwright or Cypress
4. **Visual regression**: Percy or Chromatic

## Security Notes

- All sensitive keys (private) stay in wallet
- No private keys stored client-side
- API calls signed via wallet (mock in stub)
- Environment variables prefixed `NEXT_PUBLIC_` are exposed
- CSRF protection delegated to backend

## Future Enhancements

1. **Real wallet integration**: IOTA dApp Kit
2. **Verifiable Credential rendering**: Decode & display VC details
3. **Transaction history**: Loan repayment tracking
4. **Portfolio dashboard**: Borrower's active loans overview
5. **Analytics**: Risk score trends, portfolio metrics
6. **Notifications**: On-chain event subscriptions
7. **Internationalization**: i18n support
8. **Mobile optimization**: Better responsive design
9. **Dark/light mode toggle**: Theme switching
10. **Accessibility audit**: WCAG compliance
