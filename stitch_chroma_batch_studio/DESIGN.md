---
name: Batch LUT Restoration System
colors:
  surface: '#0f1511'
  surface-dim: '#0f1511'
  surface-bright: '#343b36'
  surface-container-lowest: '#0a0f0c'
  surface-container-low: '#171d19'
  surface-container: '#1b211d'
  surface-container-high: '#252b27'
  surface-container-highest: '#303632'
  on-surface: '#dee4dd'
  on-surface-variant: '#bdcabf'
  inverse-surface: '#dee4dd'
  inverse-on-surface: '#2c322d'
  outline: '#87948a'
  outline-variant: '#3d4a42'
  surface-tint: '#69dca4'
  primary: '#69dca4'
  on-primary: '#003823'
  primary-container: '#42b883'
  on-primary-container: '#00432a'
  inverse-primary: '#006c47'
  secondary: '#9ecaff'
  on-secondary: '#003258'
  secondary-container: '#1e95f2'
  on-secondary-container: '#002b4d'
  tertiary: '#ffb3b5'
  on-tertiary: '#620f1c'
  tertiary-container: '#f68188'
  on-tertiary-container: '#6f1925'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#86f9be'
  primary-fixed-dim: '#69dca4'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#005234'
  secondary-fixed: '#d1e4ff'
  secondary-fixed-dim: '#9ecaff'
  on-secondary-fixed: '#001d36'
  on-secondary-fixed-variant: '#00497d'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b5'
  on-tertiary-fixed: '#40000b'
  on-tertiary-fixed-variant: '#802630'
  background: '#0f1511'
  on-background: '#dee4dd'
  surface-variant: '#303632'
  background-deep: '#121212'
  surface-slate: '#1e1e1e'
  text-primary: '#ffffff'
  text-secondary: '#a0a0a0'
  error-red: '#ff5252'
  border-subtle: '#2a2a2a'
typography:
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  h2:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption-mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  item-gap: 8px
---

# Stitch Design System: Batch LUT Restoration Tool

## 1. Brand Identity

- **Name**: Batch LUT Restoration
- **Concept**: Professional, High-Efficiency, Precision Media Processing.
- **Target Audience**: Content creators, DJI Action/Pocket camera users, professional videographers.
- **Visual Style**: Modern Dark Mode, "Pro Video Tool" aesthetic (similar to DaVinci Resolve or Adobe Premiere), accented with a "Restoration Green" or "Processing Blue".

## 2. Color Palette

- **Primary**: `#42b883` (Restoration Green) - Used for progress, success, and primary actions.
- **Secondary**: `#2196f3` (Processing Blue) - Used for info and secondary interactive elements.
- **Background**: `#121212` (Deep Night) - Main application background.
- **Surface**: `#1e1e1e` (Dark Slate) - Cards, lists, and input areas.
- **Text-Primary**: `#ffffff`
- **Text-Secondary**: `#a0a0a0`
- **Error**: `#ff5252`

## 3. Typography

- **Primary Font**: Inter, system-ui, sans-serif.
- **Scale**:
  - H1: 24px (Bold)
  - H2: 18px (Semi-bold)
  - Body: 14px (Regular)
  - Caption: 11px (Monospace for file paths)

## 4. Components & Layout

### A. Navigation/Header

- Compact title area with a "Pro" badge.
- Status indicator (Ready, Processing, Error).

### B. Media Management (Center Piece)

- **Drop Zone**: Large, intuitive area to drag & drop MP4 files.
- **File Grid**: A refined list or grid showing added videos with:
  - Thumbnail placeholder (generic video icon).
  - File name.
  - Quick remove button.
  - "Add more" button.

### C. Processing Controls

- **LUT Selector**: A card-style input to select the `.cube` file.
- **Output Directory**: Input to set the destination.
- **Hardware Acceleration**: Toggle/Radio buttons for CPU / NVIDIA (NVENC) / AMD (AMF).

### D. Progress & Execution

- **Main Action Button**: Large, prominent "Start Processing" button.
- **Progress Overlay/Bar**:
  - Percentage text.
  - Elapsed time timer.
  - Current processing filename.
  - Smooth animated progress bar.

## 5. Interaction Model

1. **Import**: Drag files -> Grid populates.
2. **Configure**: Select LUT and Destination.
3. **Run**: Click Start -> UI transitions to "Processing Mode" (dimming inputs, showing progress).
4. **Finish**: Success animation -> Option to open the output folder.

## 6. Layout Strategy

- **Compact View**: All-in-one screen, no scrolling for main controls.
- **Responsive**: Grid adjusts based on the number of files.
