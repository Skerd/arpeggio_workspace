# Panel UX rules (UX-*)

Scope: everything a person sees on an entity page in the panel: list cards, tables, quick filters, sheets, create and edit forms,
action menus and dialogs, and the same entity shown on public pages. The rules say **what** a good screen shows and in which order.
**How** to build it (which widgets, sections and tokens are allowed) stays in [viewconfig.md](viewconfig.md) and [frontend.md](frontend.md).
A rule here never allows a new widget, section or core change; those stay APPROVAL REQUIRED (VC-03, CORE-03).

Reference module: **dentalClinic** (D136). Other modules are brought in line when a task touches their pages (TD-F54).
**Enforce:** review, using the checklist at the end (also in [DEVELOPMENT_WORKFLOW.md](../DEVELOPMENT_WORKFLOW.md)).

---

### UX-01 · MUST · Titles name the thing
- **Rule:**
  - A card title and a sheet title name the record the way a person says it: the patient's name, the treatment's name, the location's name.
  - A generated code or number (`AP-20261110-341E53FA`, `PT-…`, `INQ-…`) never stands alone as a title. It goes in a header badge or subtitle.
  - When the name is computed (first + last name of a linked person), the sheet passes it through `headerTitle` on `SheetViewRenderer`. PM `commissionSheetView.tsx` does this.
- **Why:** in a busy list, people scan for names, not codes. In the 2026-11-11 dental review every appointment, quote and request card was titled by code.

### UX-02 · MUST · Card anatomy
- **Rule:**
  - A card shows at most four facts after its title, in this order: who/what → when → how much → state.
  - **Status:** a tone-coloured badge from the model's `enumTones` (`toneClass`), not a "Status: Confirmed" row.
  - **Images:** an entity that has photos shows the first one in the card's gallery header. Copy carRental `vehicleCard.tsx`.
  - **Booleans:** show only the exception, as a badge ("Inactive", "Hidden"). Never "Active: Yes".
  - **Empty facts:** a fact with no value is left off. Never show a "Label: ⓘ" row.
- **Why:** a card is for choosing, not reading. A card full of "Yes" rows and empty values hides the one thing that differs.

### UX-03 · MUST · Sheet order
- **Rule:** a sheet reads from the top in this order:
  1. what you act on (status, alerts, the next step);
  2. key facts;
  3. related records;
  4. secondary details;
  5. Lifecycle (always last).
- **Nothing useful renders after Lifecycle.** A custom section that has to go higher becomes a registered widget token, with approval under VC-03.
- **Each detail appears once.** Don't repeat it in two groups.
- **Technical fields stay off sheets:** slug, sort order, internal ids.
- **A linked record** shows its name and links to its sheet, not its code.
- **Why:** the dental plan, request and patient sheets put their quote lines, conversation and medical history below Lifecycle, where nobody scrolls.

### UX-04 · MUST · Forms are grouped
- **Rule:**
  - **Groups:** every field sits in a titled group (`#TitleWithCollapse` → `#FormGrid`). Nothing floats above the first group or below the last.
  - **Order:** groups follow the order the task is done in.
  - **Visibility group:** visibility and publishing switches (active, bookable online, on the website) and sort order go in a final "Visibility" group.
  - **Info notes:** go inside the group they explain.
  - **Layout:** two or three columns. Long text and media take the full width.
- **Why:** an ungrouped top block and loose switches at the bottom made every dental form read as one long list.

### UX-05 · MUST · Form flow
- **Rule:**
  - Pick an existing record before typing a new one. A new appointment starts with "Existing patient" and prefills from the folder.
  - Generate derived values instead of asking for them. A slug comes from the name.
  - Choose a reference instead of typing its number. Pick the phase; don't type "Phase no.".
  - Two fields that exclude each other become one choice ("Who: a dentist / the whole location").
  - A value picked from a list ("From the price list") comes first and fills in what follows.
- **Why:** each of these was a backwards flow in the dental forms.

### UX-06 · MUST · Defaults come from context
- **Rule:**
  - Defaults come from the company or record context:
    - language from the company or instance language;
    - time zone from the company time zone (GLB-09);
    - currency from the record's or module's currency (GLB-08);
    - hours from the location's opening hours.
  - **No accidental defaults.** Never the first enum value, and no default left over from another module. If there's no sensible default, leave the field empty.
  - **Placeholders** show an example from the entity's own domain. A treatment is never "e.g. Zurich Center".
- **Why:** an Albanian clinic's forms defaulted to Italian, Europe/Zurich and "Phone".

### UX-07 · MUST · Money is always amount + currency
- **Rule:**
  - **Display:** every amount on a card, sheet, table, dialog or public page shows its currency. Use `type: "currency"` with `valuePath: ["<currency>.symbol", "<amount>"]`; a table column declares `dynamicTableConfiguration.currencyPath` on its schema field (D149). Never a bare number, and never the currency in a separate card or column.
  - **Price types read as words:** "from €60", "Free", "On request".
  - **Inputs:** a money input says which currency it is in.
  - **Totals:** a form that builds a total shows it as you type.
  - **Comparisons:** amounts in different currencies are never compared or sorted together.
- **Why:** GLB-08 stores money with its currency. Showing it without one makes the panel disagree with the public site.

### UX-08 · MUST · Dates, durations and hours read naturally
- **Rule:**
  - Dates and times go through the GLB-09 helpers only. One date format across the panel.
  - Durations read "60 min", not "Duration (min): 60".
  - Ranges read "Mon 16 Nov, 13:00–17:00".
  - A weekly schedule is one compact week (`#WeeklyHours`), never one box per day.
  - **Every date and time input** uses the core shadcn picker `DateInput` (`sinfonia/src/modules/core/components/custom/inputs/dateInput.tsx`), in forms (`#DateInput`), dialogs, filters and public pages alike:
    - `valueFormat="YYYY-MM-DD"` for a day;
    - `timeOnly` for a time;
    - a time pattern plus `timeZone` for an instant;
    - `minDate` and `maxDate` for bounds.
  - Never the browser's own picker (`type="date"`, `type="time"`, `type="datetime-local"`).
  - A dialog that changes a date opens on the record's current value.
  - Copy carRental `counter/index.tsx`.
- **Why:** the dental message thread used US 12-hour times with seconds, and hours took a screen per day. The Move dialog and the Day view used the browser's picker ("dd.mm.yyyy"), unlike every other date in the panel.

### UX-09 · MUST · Labels, never codes
- **Rule:** enum values, languages, countries and roles show their translated label in every locale ("Albanian, English, Italian", not "sq,en,it" or "Sq AL").
- **Why:** FE-08 covers the dictionary. This rule covers the values shown in it.

### UX-10 · MUST · Empty values stay quiet
- **Rule:**
  - On sheets, an empty optional field is hidden (`dependent`). A group with nothing left is hidden too.
  - In forms, rarely used optional fields go in a collapsed group.
  - A missing value the user must provide shows as a call to action ("Add the patient's email"), not an ⓘ.
- **Why:** the dental patient sheet showed about 15 empty fields before anything useful.

### UX-11 · MUST · One noun per entity
- **Rule:** an entity has one name across the menu, page title, create button, sheet badge, dialogs and emails, in all 5 locales.
- **Why:** dental mixed "Treatment plans" and "New quote", and "Estimate requests" and "Add lead".

### UX-12 · MUST · Lists open useful and tables lead with what matters
- **Rule:**
  - **Sort:** each list route sets a `defaultSort` that matches how the list is used (upcoming first, newest first, by name).
  - **First columns:** title → when → who → amount → status.
  - **Hidden by default:** technical or rarely filled columns (codes, sort order, linked accounts).
  - **Time-based lists** (appointments, bookings) offer a "When" quick filter (Upcoming / Today / Past).
- **Why:** the dental appointments table hid both the patient and the start time.

### Controls (AGT-02, restated for screens)
Every visible control does what it says. A menu item with no target, such as "Edit" on a record that has only actions, is hidden.
A list's own sheet shows the same action menu as its row menu.

---

## Checklist (before a UI change is done)
- [ ] Titles name the thing; codes are badges (UX-01)
- [ ] Cards: at most 4 facts, status badge, image, no "Yes" rows, no empty rows (UX-02)
- [ ] Sheet order; nothing useful after Lifecycle; no technical fields; no duplicates (UX-03)
- [ ] Every form field in a titled group; switches and sort order in "Visibility" (UX-04)
- [ ] Pick before type; derived values generated; one choice for exclusive fields (UX-05)
- [ ] Defaults and placeholders from the record's own context (UX-06)
- [ ] Every amount with its currency; price types as words (UX-07)
- [ ] Dates, durations and hours via GLB-09 helpers and natural ranges; every date/time input is the core `DateInput`, never a native picker (UX-08)
- [ ] Translated labels, no codes (UX-09)
- [ ] Empty values hidden or turned into a call to action (UX-10)
- [ ] One noun per entity in all 5 locales (UX-11)
- [ ] Default sort and first columns checked; time lists have "When" (UX-12)
- [ ] Every menu item and button works (AGT-02)
