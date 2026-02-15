# F1 Companion - Visual Style Guide

## 🎨 Brand Identity

### App Concept
**F1 Companion** is a modern, racing-inspired mobile application designed for Formula 1 enthusiasts. The design language combines the speed and precision of motorsport with contemporary mobile UI patterns.

### Design Pillars
1. **Speed & Performance** - Fast animations, responsive interactions
2. **Precision & Detail** - Exact spacing, consistent alignment
3. **Racing Heritage** - Motorsport-inspired visual elements
4. **Modern Minimalism** - Clean, uncluttered interfaces
5. **Data-First** - Clear information hierarchy

---

## 🎯 Color System

### Primary Palette

#### F1 Racing Red
```
Primary Red:    #E10600  ████████
Usage: Primary actions, racing accents, active states
Examples: CTA buttons, racing stripes, active tabs

Dark Red:       #B00500  ████████
Usage: Pressed states, hover effects
Examples: Button press, active card borders
```

#### Carbon & Titanium (Dark Neutrals)
```
Carbon Black:   #15151E  ████████
Usage: Premium backgrounds, number badges, dark surfaces
Examples: Driver numbers, dark mode backgrounds

Titanium Gray:  #2A2A35  ████████
Usage: Secondary dark surfaces
Examples: Elevated cards in dark mode
```

### Podium Colors

#### Championship Metallics
```
Gold (P1):      #FFD700  ████████
Usage: First place, winner highlights
Examples: Podium cards, championship leader

Silver (P2):    #C0C0C0  ████████
Usage: Second place
Examples: Podium cards

Bronze (P3):    #CD7F32  ████████
Usage: Third place
Examples: Podium cards
```

### Tyre Compounds (Pirelli Official)

#### Racing Compounds
```
Soft (Red):     #E10600  ████████
Usage: Soft compound visualization
Examples: Stint cards, tyre strategy charts

Medium (Yellow):#FFD700  ████████
Usage: Medium compound visualization
Examples: Stint cards, tyre strategy charts

Hard (White):   #FFFFFF  ████████
Usage: Hard compound visualization
Examples: Stint cards, tyre strategy charts (with border)
```

#### Wet Compounds
```
Intermediate:   #00A650  ████████
Usage: Intermediate tyre visualization
Examples: Stint cards, weather-affected sessions

Wet (Blue):     #0066CC  ████████
Usage: Wet tyre visualization
Examples: Stint cards, rain sessions
```

### Semantic Colors

#### Flag System
```
Green Flag:     #00D856  ████████
Usage: Success, live events, good performance
Examples: Live badges, positive stats

Yellow Flag:    #FFD700  ████████
Usage: Warnings, caution
Examples: Warning messages, yellow flag indicators

Red Flag:       #E10600  ████████
Usage: Critical, errors, session stopped
Examples: Error messages, DNF status

Blue Flag:      #0095FF  ████████
Usage: Information, neutral status
Examples: Info messages, general indicators
```

### Neutral Palette

#### Grayscale
```
White:          #FFFFFF  ████████
Off-White:      #F8F8FA  ████████
Light Gray:     #E8E8ED  ████████
Gray:           #A0A0AB  ████████
Dark Gray:      #5A5A65  ████████
Almost Black:   #1A1A24  ████████
Black:          #000000  ████████
```

---

## 📝 Typography

### Font System

#### Font Families
```
Display/Heading: System Font (SF Pro / Roboto)
Body Text:       System Font
Monospace:       Menlo / Courier (for lap times)
```

#### Type Scale
```
5XL:  42px  ████████  Main headers, hero text
4XL:  34px  ███████   Section headers
3XL:  28px  ██████    Card headers
2XL:  24px  █████     Subsection headers
XL:   20px  ████      Large body, important text
LG:   17px  ███       Standard large text
BASE: 15px  ██        Body text (default)
SM:   13px  █         Secondary text
XS:   11px  ▌         Labels, captions
```

#### Font Weights
```
Regular:  400  Normal body text
Medium:   500  Emphasized text
Semibold: 600  Subheadings
Bold:     700  Headings, important data
Heavy:    800  Large numbers, stats
Black:    900  Hero text, major headers
```

#### Letter Spacing
```
Tight:   -0.5px  Large headers (compress for impact)
Normal:   0px    Body text
Wide:    +0.5px  Small labels
Wider:   +1px    Uppercase labels
Widest:  +2px    Racing numbers, badges
```

### Typography Usage Examples

#### Headers
```typescript
// Page Title
{
  fontSize: 42,
  fontWeight: '900',
  letterSpacing: -0.5,
  color: '#15151E',
}

// Section Header
{
  fontSize: 24,
  fontWeight: '700',
  letterSpacing: -0.5,
  color: '#15151E',
}

// Card Title
{
  fontSize: 20,
  fontWeight: '700',
  color: '#E10600',
}
```

#### Body Text
```typescript
// Primary Body
{
  fontSize: 15,
  fontWeight: '400',
  lineHeight: 22.5, // 1.5x
  color: '#15151E',
}

// Secondary Body
{
  fontSize: 13,
  fontWeight: '400',
  color: '#5A5A65',
}
```

#### Labels & Captions
```typescript
// Uppercase Label
{
  fontSize: 11,
  fontWeight: '600',
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: '#A0A0AB',
}

// Data Label
{
  fontSize: 13,
  fontWeight: '500',
  color: '#5A5A65',
}
```

#### Monospaced (Timing Data)
```typescript
// Lap Times
{
  fontSize: 16,
  fontFamily: 'Menlo',
  fontWeight: '700',
  fontVariant: ['tabular-nums'],
  color: '#E10600',
}
```

---

## 📐 Spacing & Layout

### 8px Grid System

All spacing follows multiples of 8:
```
4px  (0.5 unit)  ▌       Micro spacing
8px  (1 unit)    █       Small gaps
12px (1.5 units) █▌      Medium-small gaps
16px (2 units)   ██      Base spacing (default)
20px (2.5 units) ██▌     Medium gaps
24px (3 units)   ███     Large gaps
32px (4 units)   ████    Section spacing
40px (5 units)   █████   Major section spacing
48px (6 units)   ██████  Page section spacing
64px (8 units)   ████████Hero spacing
```

### Component Spacing

#### Cards
```
Padding:        16px (base)
Margin Bottom:  16px (base)
Border Radius:  12px (lg)
Gap Between:    12px (md)
```

#### Lists
```
Item Padding:   16px vertical, 16px horizontal
Item Gap:       8px between items
Section Gap:    24px between sections
```

#### Forms
```
Input Height:   48px
Input Padding:  16px horizontal
Label Spacing:  8px below label
Field Gap:      16px between fields
```

---

## 🎭 Shadows & Elevation

### Shadow Levels

#### Level 1 - Subtle
```typescript
{
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowOffset: { width: 0, height: 1 },
  shadowRadius: 2,
  elevation: 1,
}
// Usage: Small badges, subtle cards
```

#### Level 2 - Standard
```typescript
{
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 3,
}
// Usage: Cards, list items, normal elevation
```

#### Level 3 - Elevated
```typescript
{
  shadowColor: '#000',
  shadowOpacity: 0.16,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 16,
  elevation: 5,
}
// Usage: Modals, floating buttons, important cards
```

#### Racing Glow
```typescript
{
  shadowColor: '#E10600',
  shadowOpacity: 0.15,
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 12,
  elevation: 4,
}
// Usage: Live badges, active states, racing accents
```

---

## 🎬 Animation & Motion

### Animation Timing

#### Duration
```
Instant:  100ms  Quick feedback
Fast:     200ms  Standard transitions
Normal:   300ms  Default (most animations)
Slow:     500ms  Emphasis, important changes
Slower:   700ms  Page transitions, hero animations
```

#### Easing Curves
```
Linear:       linear            Constant speed
Ease In:      ease-in          Acceleration
Ease Out:     ease-out         Deceleration (default)
Ease In-Out:  ease-in-out      Smooth both ends
Spring:       cubic-bezier     Bouncy, playful
Racing:       cubic-bezier     Fast acceleration (F1-style)
              (0.87, 0, 0.13, 1)
```

### Animation Patterns

#### Entry Animations
```typescript
// Fade + Slide Up
{
  opacity: 0 → 1
  translateY: 20 → 0
  duration: 400ms
  delay: index * 100ms (stagger)
}
```

#### Press Feedback
```typescript
// Scale Down
{
  scale: 1 → 0.97
  spring: { speed: 50, bounciness: 4 }
}
```

#### Active State
```typescript
// Lift + Scale
{
  scale: 1 → 1.1
  translateY: 0 → -4
  spring: { friction: 5 }
}
```

---

## 🏗️ Component Patterns

### Card Design

#### Standard Card
```
┌─────────────────────────────┐
│ ▌Content                    │ ← 4px accent bar (left)
│ ▌Header Text                │
│ ▌Body content               │
│ ▌Footer info                │
└─────────────────────────────┘
  12px border radius
  8px shadow
  1px border
  16px padding
```

#### Racing Card
```
┌─────────────────────────────┐
█ Header with icon            │ ← Red accent bar (top)
├─────────────────────────────┤
│ Stats Grid                  │
│ [Icon] [Icon] [Icon]        │
│  Data   Data   Data         │
├─────────────────────────────┤
│ Additional info             │
█─────────────────────────────┘ ← Red accent bar (bottom)
```

### Button Styles

#### Primary Button
```
┌──────────────┐
│   ACTION     │
└──────────────┘
  Background: #E10600
  Text: #FFFFFF
  Height: 48px
  Padding: 16px horizontal
  Border Radius: 8px
  Font: 16px, Bold
```

#### Secondary Button
```
┌──────────────┐
│   ACTION     │
└──────────────┘
  Background: Transparent
  Border: 2px #E10600
  Text: #E10600
  Height: 48px
```

#### Ghost Button
```
  ACTION
  
  Background: Transparent
  Text: #E10600
  Underline on press
```

### Badge Design

#### Status Badge
```
 ┌────────┐
 │  LIVE  │
 └────────┘
   8px padding horizontal
   4px padding vertical
   Full border radius
   Uppercase text
   11px font size
   Bold weight
```

#### Number Badge
```
   ┌────┐
   │ 33 │
   └────┘
   36x36px circle
   Carbon black background
   White text
   Bold font
```

---

## 🚀 Racing-Specific Elements

### Racing Stripe
```
Vertical accent on left edge of cards
Width: 4px
Colors: Red (default), Green (live), Gray (finished)
Full height of card
```

### Podium Indicator
```
1st: 🥇 + Gold background
2nd: 🥈 + Silver background  
3rd: 🥉 + Bronze background
```

### Live Indicator
```
┌─────────┐
│ ● LIVE  │
└─────────┘
  Pulsing dot animation
  Green background
  White text
  Bold, uppercase
```

### Compound Badge
```
┌─────────────┐
│ 🔴 SOFT     │
└─────────────┘
  Tyre icon
  Compound color background
  White text
  Uppercase
```

---

## 📱 Screen Templates

### List Screen
```
┌─────────────────────────────┐
│                             │
│  GRADIENT HEADER            │ ← Hero section
│  Large Title                │
│  Stats Bar                  │
│                             │
├─────────────────────────────┤
│ ┌─────────────────────┐     │
│ │ List Item Card      │     │
│ └─────────────────────┘     │
│                             │
│ ┌─────────────────────┐     │
│ │ List Item Card      │     │
│ └─────────────────────┘     │
└─────────────────────────────┘
```

### Detail Screen
```
┌─────────────────────────────┐
│  Hero Image / Circuit       │
├─────────────────────────────┤
│  Title & Meta Info          │
├─────────────────────────────┤
│  Stats Section              │
│  [Data] [Data] [Data]       │
├─────────────────────────────┤
│  Content Sections           │
│  • Section 1                │
│  • Section 2                │
└─────────────────────────────┘
```

---

## ✨ Interactive States

### Touch States

#### Normal
```
Background: White
Border: Light Gray
Shadow: Standard
```

#### Pressed
```
Background: Off-White
Scale: 0.97
Shadow: Reduced
```

#### Active/Selected
```
Background: Red (10% opacity)
Border: Red
Racing stripe: Visible
Scale: 1.05
```

#### Disabled
```
Background: Light Gray
Text: Gray
Opacity: 0.5
```

---

## 🎨 Gradients

### Racing Gradient
```
Colors: ['#E10600', '#B00500', '#15151E']
Direction: Diagonal (top-left to bottom-right)
Usage: Headers, hero sections
```

### Podium Gradient
```
Colors: ['#FFD700', '#FFA500', '#FF6B00']
Direction: Horizontal
Usage: Winner highlights
```

### Speed Gradient
```
Colors: ['#0095FF', '#0066CC', '#003E7A']
Direction: Horizontal
Usage: Info sections, data viz
```

---

## 📏 Icon System

### Icon Sizes
```
Small:   16px  Navigation, inline
Medium:  24px  Tabs, standard UI
Large:   32px  Feature icons
XLarge:  48px  Empty states, illustrations
```

### Icon Usage
```
Trophy:      Podium, results, championships
Flag:        Laps, sessions, racing
Calendar:    Events, schedule
Speedometer: Performance, speed, timing
Build:       Pit stops, mechanics
Location:    Circuits, venues
People:      Drivers, teams
Stats:       Data, analytics
```

---

## 🔧 Implementation Checklist

### For Each Screen
- [ ] Use theme constants (no hardcoded values)
- [ ] Follow 8px spacing grid
- [ ] Implement entry animations
- [ ] Add press feedback to touchables
- [ ] Use proper shadow elevation
- [ ] Maintain typography hierarchy
- [ ] Add loading states
- [ ] Add empty states
- [ ] Add error states
- [ ] Test on iOS and Android

### For Each Component
- [ ] Use semantic color names
- [ ] Apply consistent border radius
- [ ] Use proper spacing values
- [ ] Add accessibility labels
- [ ] Implement proper types
- [ ] Add prop validation
- [ ] Document usage
- [ ] Test with real data

---

## 🎯 Quality Standards

### Visual Quality
- Sharp, crisp edges (no blurry text or images)
- Consistent alignment across all elements
- Balanced white space
- Clear visual hierarchy
- Professional color combinations

### Interaction Quality
- Immediate feedback (<100ms)
- Smooth animations (60fps)
- Intuitive gestures
- Clear affordances
- Appropriate touch targets (min 44x44)

### Performance Quality
- Fast load times
- No jank or stuttering
- Efficient memory usage
- Optimized images
- Lazy loading where appropriate

---

This style guide ensures consistency across the entire F1 Companion app, creating a cohesive, professional racing experience that delights motorsport enthusiasts! 🏁
