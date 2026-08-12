# Claude.md - Investmentstratege (Pragmatisch)

> **This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md**

**3-Layer Architecture + Inline Skills für sofortige Nutzung in Claude Code**

Status: ✅ Production Ready | Focus: Sofort Umsetzbar | Last Updated: August 2026

---

## 🏗️ The 3-Layer Architecture

You operate in 3 layers that separate concerns:

### **Layer 1: Directive (What to do)**
- Clear, written SOPs in `directives/`
- Goals, inputs, tools, outputs, edge cases
- Example: `directives/create_dashboard_widget.md`

### **Layer 2: Orchestration (Decision making)**
This is you. Read directive → invoke inline skills → deliver result

### **Layer 3: Execution (Deterministic code)**
Python scripts in `execution/` for reliable, repeatable work

**Why:** Push complexity into deterministic code. 90% accuracy per step = 59% over 5 steps. With scripts: 99%+ per step.

---

## 📋 Inline Skills (Copy-Paste Ready)

These skills are embedded here, ready to use in Claude Code immediately.

---

## 🎨 SKILL 1: Design Direction (Taste)

**When:** You need design direction, inspiration, or want to avoid "AI-generated" look

**How to Use:**

```
Claude: "Gib mir design direction für [component].
Inspiriert von: [Apple/Linear/Vercel/Stripe].
Stil: [minimal/bold/playful]"
```

**Prompt Template (Copy-Paste):**

```
Design Direction for [Component Name]

Context: Investmentstratege - Financial Dashboard for retail investors

Requirements:
- Professional, trustworthy feeling
- Minimal design (Apple-inspired preferred)
- High contrast + readable
- Premium but not flashy

Reference style: [Choose 1-3]
- Apple: Clean, minimal, spacious, premium
- Linear: Modern, refined, subtle details
- Vercel: Dark-friendly, high contrast, tech-forward
- Stripe: Professional, trustworthy, financial

Questions to answer:
1. What feeling should [component] evoke?
2. What's the primary action users take?
3. What data matters most?
4. Mobile or desktop first?

Deliverable: 
- Color palette (3-5 colors with HEX)
- Typography scale
- Component sketches
- Do's and Don'ts
```

**Expected Output:**
- Color palette with HEX values
- Typography recommendations
- Component sketches/descriptions
- Do's & Don'ts

---

## 🎯 SKILL 2: Layout & Design System (UI/UX Pro Max)

**When:** You need professional layout, design system, or responsive structure

**How to Use:**

```
Claude: "Erstelle design system für [component].
Grid: 8px, Breakpoints: mobile/tablet/desktop.
Nutze: [color-palette] colors, [typography-scale]"
```

**Prompt Template (Copy-Paste):**

```
Build Professional Layout for [Component]

Context: Investmentstratege Dashboard
Component: [Specify: Portfolio, Holdings, Performance, Allocation, etc]

Design Inputs:
- Color Palette: [paste colors with HEX]
- Typography: [paste scale: Display 32px, H1 24px, Body 16px, etc]
- Grid System: 8px base
- Spacing: 8px, 16px, 24px, 32px
- Breakpoints: 
  * Mobile: < 640px
  * Tablet: 640px - 1024px
  * Desktop: > 1024px

Requirements:
- Layout grid (12 columns on desktop, 4 on mobile)
- All states: default, hover, active, disabled, loading
- Responsive behavior for all breakpoints
- Accessibility: touch targets 44x44px minimum

Deliver:
- Component structure (HTML/React markup)
- CSS Grid or Flexbox layout
- Component spacing + padding rules
- Hover/focus/active states
- Mobile/tablet/desktop variations
```

**Expected Output:**
- Component structure
- Responsive layouts
- State definitions
- CSS/React code

---

## ✨ SKILL 3: Animation Framework (Emil Design Eng)

**When:** You need smooth animations, transitions, or interactive feel

**How to Use:**

```
Claude: "Füge smooth animations hinzu für [component].
State changes, entry animations, transitions.
Timing: micro (200ms), component (300ms)"
```

**Prompt Template (Copy-Paste):**

```
Create Smooth Animations for [Component]

Framework: Emil Kowalski Motion Framework

Animation Principles:
1. Easing Selection:
   - Elements ENTERING: ease-out (schnell → langsam)
   - Elements on SCREEN moving: ease-in-out (smooth beide Richtungen)
   - Elements EXITING: ease-in (langsam → schnell)
   - Continuous (spinner): linear

2. Timing:
   - Micro-interactions (button hover): 150-200ms
   - State changes (tab switch): 200ms
   - Component transitions (modal): 200-300ms
   - Page transitions: 300-500ms
   - Scroll reveals: 500-700ms

3. Performance (CRITICAL):
   - Only animate: transform, opacity (GPU-accelerated)
   - NEVER animate: left, top, width, height
   - Target: 60fps (check DevTools Performance)

4. Accessibility:
   - Include: @media (prefers-reduced-motion: reduce) { animation: none; }
   - Fallback for users with motion sensitivity

Identify Animations:
- State transitions (data updates, loading states)
- Micro-interactions (hovers, clicks)
- Entry animations (components appear)
- Exit animations (components disappear)

Implementation:
- Use Framer Motion (React) or CSS animations
- Duration: [specify from timing guide above]
- Easing: [specify from easing selection above]
- GPU-accelerated only

Deliverable:
- Animation code (React/CSS)
- Performance validation (60fps)
- Accessibility compliance
```

**Expected Output:**
- Animation code (React/CSS)
- Proper easing functions
- Correct durations
- No jank (60fps)

---

## 🔍 SKILL 4: Polish & Refinement (Impeccable Design)

**When:** Your UI is done but needs final refinement

**How to Use:**

```
Claude: "/polish für [component].
Spacing, typography, contrast, hover states verfeinern."
```

**Prompt Template (Copy-Paste):**

```
Polish UI for [Component]

Refinement Checklist:

SPACING (8px grid):
- Margins: use 8px, 16px, 24px, 32px (NO magic numbers)
- Padding: same grid
- Gaps between components: consistent
- Whitespace: generous and purposeful

TYPOGRAPHY:
- Font sizes: follow scale (32, 24, 20, 18, 16, 14, 12px)
- Line heights: body 1.5, headings 1.2-1.3
- Letter spacing: subtle (0.5px for headings optional)
- Max line width: 600-700px for readability

COLOR & CONTRAST:
- Text vs Background: minimum 4.5:1 (WCAG AA)
- All interactive elements: clear indication
- Hover states: subtle color shift
- Disabled states: 50% opacity

COMPONENT STATES:
- Hover: slight elevation or color shift
- Active/Focus: clear visual indicator
- Disabled: 50% opacity, no pointer
- Loading: skeleton or spinner
- Error: red text + icon
- Success: green text + checkmark

BORDERS:
- Color: light gray (#E5E7EB or similar)
- Width: 1px (rarely 2px)
- Radius: 4px (buttons), 8px (cards)
- NEVER: hard dark borders

SHADOWS:
- Elevation 1: 0 1px 2px rgba(0,0,0,0.05)
- Elevation 2: 0 4px 6px rgba(0,0,0,0.1)
- Elevation 3: 0 10px 15px rgba(0,0,0,0.1)
- NEVER: harsh shadows

Deliverable:
- Refined component code
- Consistent spacing/typography
- Professional appearance
- Contrast verified
```

**Expected Output:**
- Polished component
- Consistent spacing
- Professional look
- Verified contrast

---

## 📸 SKILL 5: Screenshot to Code (Image To Code)

**When:** You have a mockup/design and need working code fast

**How to Use:**

```
Claude: "Konvertiere diese design-screenshot zu React.
Funktioniert auf mobile/tablet/desktop.
Nutze: [design-system-from-skill-1]"
```

**Prompt Template (Copy-Paste):**

```
Convert Design Screenshot to React Code

Input: [Describe screenshot or upload image]
Design System to Use:
- Colors: [paste from design direction skill]
- Typography: [paste scale]
- Spacing: 8px grid
- Components: [list what you see]

Requirements:
- React functional component
- Tailwind CSS or styled-components
- Responsive (mobile first)
- No hardcoded data (use props)
- Accessible (semantic HTML, ARIA where needed)
- Clean, readable code

States to Include:
- Default state
- Hover state (if interactive)
- Loading state (if data)
- Error state (if data)

Deliverable:
- React component in src/components/[Name].tsx
- CSS or Tailwind styles
- Props interface
- Ready to use
```

**Expected Output:**
- Working React component
- Responsive design
- All states included
- Production-ready

---

## 🕷️ SKILL 6: Web Scraping (DIY Scraper)

**When:** You need to gather data from websites for research/inspiration

**How to Use:**

```
Claude: "Scrape https://vercel.com für design inspiration.
Extrahiere: colors, typography, layout patterns.
Speichere als JSON."
```

**Prompt Template (Copy-Paste):**

```
Scrape Website for Design Research

Target URL: [URL]

What to Extract:
- Color palette (all unique colors with HEX)
- Typography (fonts, sizes, weights)
- Spacing patterns (margins, padding)
- Component patterns (buttons, cards, etc)
- Layout structure (grid, flexbox)
- Design tokens (shadows, border-radius, etc)

Constraints:
- Respect robots.txt
- Follow Terms of Service
- No login bypass
- 1-2 requests per minute max
- Identify with User-Agent

Output Format:
```json
{
  "url": "[source]",
  "colors": {
    "primary": "#HEX",
    "secondary": "#HEX"
  },
  "typography": {
    "font_family": "Name",
    "sizes": [...]
  },
  "spacing": {
    "grid_base": "8px",
    "margins": [...]
  },
  "patterns": [...]
}
```

Tools Available:
- requests + BeautifulSoup (static HTML)
- Playwright (JavaScript, screenshots)
- Simple Python script in execution/scrape_website.py

Deliverable:
- design_tokens.json with extracted data
- screenshots/ folder (if needed)
- analysis of design quality

```

**Expected Output:**
- JSON with design tokens
- Structured data
- Analysis notes

---

## ✅ SKILL 7: Code Quality Audit (Web Design Guidelines)

**When:** Your code is done, need final quality check

**How to Use:**
```

Claude: "Audite diesen code gegen web design guidelines.
Accessibility, performance, responsive, quality."

```

**Prompt Template (Copy-Paste):**
```

Audit Code Against Web Design Guidelines

Code: [paste or describe]

ACCESSIBILITY (WCAG AA):
- Color contrast ≥ 4.5:1 ✓?
- Semantic HTML (h1, button, nav) ✓?
- ARIA labels where needed ✓?
- Keyboard navigation works ✓?
- Focus indicators visible ✓?
- Alt text for images ✓?
- Form labels associated ✓?

PERFORMANCE:
- LCP (Largest Contentful Paint) < 2.5s ✓?
- FID (First Input Delay) < 100ms ✓?
- CLS (Cumulative Layout Shift) < 0.1 ✓?
- No render-blocking resources ✓?
- Images optimized ✓?

RESPONSIVE DESIGN:
- Mobile (< 375px) ✓?
- Tablet (640px - 1024px) ✓?
- Desktop (> 1024px) ✓?
- Touch targets 44x44px ✓?
- No horizontal scrolling ✓?

TYPOGRAPHY:
- Base font size ≥ 16px ✓?
- Line height 1.4-1.6 (body) ✓?
- Max line length 600-700px ✓?
- Hierarchy clear ✓?

LAYOUT & SPACING:
- 8px grid consistent ✓?
- Margins/padding symmetrical ✓?
- Whitespace purposeful ✓?
- No magic numbers ✓?

COMPONENT QUALITY:
- States complete (hover, active, disabled) ✓?
- Feedback clear (error, success, loading) ✓?
- Animations purposeful ✓?
- Reusable/modular ✓?

Output:
- Issues found (Critical/Warning/Info)
- Fixes recommended
- Overall score: X/10
- Ready for deployment: Yes/No

```

**Expected Output:**
- Issues & recommendations
- Quality score
- Pass/fail status

---

## 📁 File Organization

```

investmentstratege/
├── Claude.md                    # This file (main instructions)
├── directives/
│   ├── create_dashboard_widget.md
│   ├── scrape_competitor_design.md
│   └── audit_code.md
├── execution/
│   └── scrape_website.py        # Python scraper (deterministic Layer 3)
├── .env                         # Config (API keys, timeouts, etc)
├── .claude/skills/              # 14 skills (reference, if needed)
├── .tmp/                        # Intermediate files
│   ├── screenshots/
│   ├── scraped_data/
│   └── design_tokens/
└── src/                         # Your actual code
    ├── components/
    ├── styles/
    └── utils/

```

---

## 🔄 Self-Annealing Loop

When something breaks:

```

1. ERROR DETECTED
   ↓
2. READ ERROR MESSAGE
   ↓
3. FIX (in skill prompt or script)
   ↓
4. TEST AGAIN
   ↓
5. UPDATE DIRECTIVE
   → Document what you learned
   → Add to edge cases
   → Next time: faster
   ↓
6. SYSTEM IS STRONGER

```

**Example:**
```

Error: "Component looks unprofessional"
    ↓
Cause: Spacing not consistent (magic numbers)
    ↓
Fix: Apply 8px grid system (Skill 4: /polish)
    ↓
Update: directives/create_dashboard_widget.md
  "Always use 8px grid for spacing"
    ↓
Result: All future components consistent

```

---

## 🎯 Common Workflows

### **Workflow 1: Build New Widget (2-4 hours)**

1. **Design Direction** (Skill 1)
   ```
   Claude: "Design direction für [widget].
   Inspiriert von Linear. Minimal, professional."
   ```

2. **Layout** (Skill 2)
   ```
   Claude: "Build layout für [widget].
   8px grid, responsive, 12 columns desktop."
   ```

3. **Screenshot to Code** (Skill 5)
   ```
   Claude: "Konvertiere mockup zu React.
   Nutze design system von oben."
   ```

4. **Animations** (Skill 3)
   ```
   Claude: "Add smooth animations.
   Micro 200ms, state changes 300ms."
   ```

5. **Polish** (Skill 4)
   ```
   Claude: "/polish für final refinement."
   ```

6. **Audit** (Skill 7)
   ```
   Claude: "Audit code against guidelines."
   ```

7. **Done**
   - Component in `src/components/`
   - Screenshot in `.tmp/screenshots/`
   - No issues in audit

---

### **Workflow 2: Learn from Competitors (1-2 hours)**

1. **Scrape** (Skill 6)
   ```
   Claude: "Scrape vercel.com für design.
   Extract: colors, typography, spacing, components."
   ```

2. **Design Direction** (Skill 1)
   ```
   Claude: "Evaluate scraped design.
   Was ist gut? Was können wir lernen?"
   ```

3. **Apply** (Skills 2+4)
   ```
   Claude: "Nutze diese pattern für unseren widget."
   ```

---

### **Workflow 3: Rapid Prototype (1 hour)**

1. **Screenshot to Code** (Skill 5)
2. **Animations** (Skill 3)
3. **Polish** (Skill 4)
4. **Done**

---

## 💡 Operating Principles

### **1. Check Tools First**
Before doing anything:
- Is there a skill for this? (7 inline skills above)
- Is there a directive? (check `directives/`)
- Is there a script? (check `execution/`)
- Only write new code if nothing exists

### **2. Self-Anneal**
When something breaks:
- Fix it
- Test it
- Update the relevant skill/directive
- System gets stronger

### **3. Use the 3 Layers**
```

Layer 1: What to do (Directive)
  ↓
Layer 2: You (Orchestration - which skill to call)
  ↓
Layer 3: How to do it (Skill implementation or Script)

```

### **4. Prompt Copy-Paste**
Every skill above has a "Prompt Template" you can copy-paste directly into Claude Code. Just fill in the [brackets].

---

## 📋 Pre-Deployment Checklist

- [ ] Design Direction approved (Skill 1)
- [ ] Layout responsive (Skill 2 - tested on mobile/tablet/desktop)
- [ ] Animations smooth (Skill 3 - 60fps confirmed)
- [ ] UI polished (Skill 4 - no spacing issues)
- [ ] Code clean (Skill 5 - converted from design)
- [ ] Audit passed (Skill 7 - WCAG AA, responsive, performance)
- [ ] Screenshots taken (in `.tmp/screenshots/`)
- [ ] Ready to commit

---

## 🚀 Quick Start (Right Now)

### **Copy This File to Your Project**
```bash
cp Claude.md investmentstratege/
```

### **Create Directives Directory**

```bash
mkdir -p directives/
```

### **Try Your First Workflow**

In Claude Code, paste:

```
Gib mir design direction für ein Performance-Widget.
Investmentstratege Dashboard.
Inspiriert von: Linear (modern, refined).
Stil: minimal, professional, trustworthy.

Liefere: Color palette, typography scale, do's & don'ts.
```

→ You'll get design direction from **Skill 1** inline

### **That's It**
You're using the system. Continue with Skills 2-7 as needed.

---

## ✨ What Makes This Work

✅ **Pragmatic** - Copy-paste ready prompts, no external links  
✅ **Inline** - All skills embedded in this file  
✅ **Layered** - Clear separation (directive → orchestration → execution)  
✅ **Self-Healing** - Self-anneal loop improves over time  
✅ **Fast** - Templates speed up common workflows  
✅ **Free** - No APIs, no costs, all open-source  
✅ **Investmentstratege-Focused** - Designed for financial dashboard  

---

## 📚 Related Resources

If you need more details, refer to:
- `directives/create_dashboard_widget.md` - Full example
- `execution/scrape_website.py` - Scraper implementation
- Emil Kowalski: https://emilkowal.ski (motion philosophy)
- Apple Design: https://developer.apple.com/design (system reference)

---

## 🎉 You're Ready

You have 7 inline skills, 3-layer architecture, and pragmatic templates.

Start with: **Skill 1 (Design Direction)** for any new component.

Everything you need is in this file.

**Viel Erfolg beim Bauen!** 🚀

---

**Status:** ✅ Production Ready  
**Skills:** 7 (Inline, Copy-Paste)  
**Architecture:** 3-Layer  
**Date:** August 2026  
**For:** Claude Code (Investmentstratege)
