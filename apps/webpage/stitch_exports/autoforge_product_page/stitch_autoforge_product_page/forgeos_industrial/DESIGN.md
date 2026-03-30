# THE DESIGN SYSTEM: INDUSTRIAL PRECISION & HIGH-PERFORMANCE EXECUTION

## 1. Overview & Creative North Star
**Creative North Star: "The Machined Monolith"**

This design system is engineered to reflect the high-torque, precision-focused environment of modern automotive execution. It moves away from the "softness" of consumer SaaS and instead adopts an **Industrial Editorial** aesthetic. We prioritize raw speed, mechanical accuracy, and authoritative data density. 

The interface is not "built"; it is "machined." By utilizing sharp 0px radii (The "No-Curve" Rule), high-contrast tonal layering, and an aggressive typographic scale, we create a workspace that feels like a high-end performance diagnostic tool. We break the template look through **intentional asymmetry**—using heavy vertical accents and monospaced data readouts—to ensure every pixel feels like a deliberate engineering choice.

---

## 2. Colors & Surface Logic
The palette is rooted in deep obsidian tones, punctuated by high-visibility "Warning Red" and "Performance Green."

### The "No-Line" Rule
**Borders are prohibited for structural sectioning.** 1px solid lines create visual clutter that slows down the user’s eye. Instead, boundaries are defined strictly through background shifts. Use `surface_container_low` for secondary panels and `surface_container_highest` for active workspaces.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested metal plates. 
- **Base Layer:** `surface` (#131313)
- **Primary Work Areas:** `surface_container` (#201F1F)
- **Active Modals/Overlays:** `surface_container_highest` (#353534)
*Example: A data table (Surface Container Low) sitting on a dashboard background (Surface) requires no border—the tonal shift provides the definition.*

### The "Glass & Carbon" Effect
To prevent the dark mode from feeling flat, use high-opacity glassmorphism for floating navigation elements. Use a `surface_container` color at 80% opacity with a `40px` backdrop blur. This allows the neon accents of the underlying data to bleed through subtly, maintaining depth without sacrificing the "industrial" weight.

---

## 3. Typography
The type system creates a dialogue between **Space Grotesk** (Command) and **Inter** (Execution), with **JetBrains Mono** reserved for precision data.

*   **Display & Headlines (Space Grotesk):** These are your "Aggressive Commands." Use `display-lg` for hero metrics and `headline-md` for section titles. The wide aperture of Space Grotesk provides an authoritative, technical feel.
*   **Body & Titles (Inter):** Used for high-speed reading. `body-md` is the workhorse for dealer notes and vehicle specs.
*   **The Precision Layer (JetBrains Mono):** All VINs, pricing, and timestamps must use a monospaced font. This ensures that columns of numbers align perfectly, reflecting industrial precision.

---

## 4. Elevation & Depth
In this design system, "Up" is not defined by shadows, but by **Luminance and Polish.**

*   **The Layering Principle:** Depth is achieved by stacking. A `surface_container_lowest` card placed on a `surface_container_high` background creates a "recessed" effect, like a tool fitted into a machined foam tray.
*   **Ambient Shadows:** Traditional drop shadows are replaced by "Glow Gradients." For urgent alerts, use a `primary_container` (#CC0000) shadow with a 60px blur at 10% opacity. This mimics the glow of an engine warning light.
*   **The Ghost Border Fallback:** If a divider is strictly required for accessibility, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons: The Kinetic Trigger
*   **Primary:** Sharp edges (0px). Background: `primary_container` (#CC0000). Text: `on_primary_container` (White). Transition: On hover, shift to `primary` (#FFB4A8).
*   **Success Action:** Background: `secondary_container` (#2FF801). This is used exclusively for "Deal Closed" or "Service Complete."
*   **Tertiary:** No background. `outline` color text. Underline appears only on hover.

### Inputs: The Data Entry Port
*   **Style:** Minimalist. No background fill—only a bottom border (2px) using `outline_variant`. 
*   **Active State:** The bottom border transforms to `primary_container` (#CC0000) with a subtle vertical glow.

### Cards: The Machined Container
*   **Rule:** Forbid the use of divider lines within cards.
*   **Layout:** Use `spacing-8` (2rem) of vertical white space to separate content chunks. Use `surface_container_low` for the card body.

### Data Chips: High-Visibility Indicators
*   **Function:** Used for vehicle status (e.g., "In Transit," "Sold").
*   **Style:** Sharp corners. High contrast. Backgrounds should use the `fixed_dim` variants to ensure text legibility.

### Additional Component: The "Performance HUD"
*   A specialized dashboard widget using `surface_container_lowest` with a left-hand 4px accent bar of `secondary` (#D7FFC5) to indicate real-time performance metrics.

---

## 6. Do’s and Don’ts

### Do:
*   **DO** use 0px border-radius on everything. Sharpness equals precision.
*   **DO** use `JetBrains Mono` for any string of characters containing numbers.
*   **DO** lean into high contrast. If a component feels "soft," increase the background darkness.
*   **DO** use asymmetric layouts. Align headers to the far left and actions to the far right to create a wide, cinematic field of view.

### Don’t:
*   **DON’T** use shadows to define cards. Use tonal background shifts.
*   **DON’T** use "Pastel" versions of red or green. Only use the "Forge" and "Neon" intensities.
*   **DON’T** use center-alignment for text. Everything in a high-performance system is "Reset to Zero" (Left-aligned).
*   **DON’T** use icons for primary navigation without labels. Clarity is more important than minimalism.