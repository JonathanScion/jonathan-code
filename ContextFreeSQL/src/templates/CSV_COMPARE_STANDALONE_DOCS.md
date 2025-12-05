# CSV Comparison Tool - Complete Documentation

## Overview

**File**: `csv_compare_standalone.html`
**Type**: Single-page HTML application (completely standalone)
**Purpose**: Compare two CSV files or pasted data with advanced filtering, searching, sorting, and selective export capabilities

**Key Characteristic**: This is a **single self-contained HTML file** with no external dependencies. It works completely offline and can be shared as a single file.

---

## Features

### 1. Data Loading (Multiple Methods)

#### File Upload
- **Button**: "Choose CSV File" on both Source (left) and Target (right) panels
- **Drag & Drop**: Drag CSV files directly onto the paste area
- **Visual Feedback**: Border turns solid purple when dragging over the drop zone
- **File Types**: Accepts `.csv` and `.txt` files
- **Preview**: Shows first 20 rows + header in the textarea after loading
- **Warning**: Yellow warning box appears if file has >20 rows: "⚠️ Showing preview of first 20 rows only. Full file will be used for comparison."

#### Manual Paste
- Paste CSV data directly into textarea
- No row limit on pasted data
- Real-time parsing as you type

#### Status Indicators
- **Empty**: Yellow background - "No data loaded"
- **Loaded**: Green background - "Loaded X rows, Y columns"
- **Error**: Red background - Shows parse error message

### 2. Key Column Selection

**Location**: Appears after both sides are loaded

**Features**:
- Shows only columns that exist in BOTH datasets (common columns)
- Multi-select support (composite keys)
- Visual feedback: Selected keys turn purple with white text
- Compare button enables only when at least one key is selected
- Error handling: Shows error if no common columns found

**Behavior**:
- Click checkbox OR click entire pill to toggle selection
- Composite keys are joined with `||` separator internally

### 3. Comparison Logic

**Algorithm**:
1. Build composite key from selected column(s) for each row
2. Index source and target data by composite key (using Map)
3. Match rows by key and classify as:
   - **Equal** (✓ green): All column values match
   - **Different** (≠ red): Row exists in both but values differ
   - **Only Source** (L blue): Key exists only in source
   - **Only Target** (R orange): Key exists only in target
4. Highlight changed columns in yellow for "Different" rows

**Data Model**:
```javascript
{
    status: 'equal' | 'different' | 'left-only' | 'right-only',
    leftValues: {...} | null,
    rightValues: {...} | null,
    changedColumns: ['col1', 'col2', ...]
}
```

### 4. Comparison Results UI

#### Statistics Bar (Top)
- Shows total counts for each status category
- Updates based on filtered results
- Color-coded: Green (equal), Red (different), Blue (only source), Orange (only target)

#### Global Search
- **Location**: Top of controls area
- **Searches**: Across all columns and all data
- **Scope Filters**:
  - Source checkbox with count
  - Target checkbox with count
- **Behavior**: Case-insensitive partial match

#### Status Filters
- **Location**: Right side of controls
- **Options**: Equal, Only Source, Only Target, Different (each with count badge)
- **Behavior**: Toggle checkboxes to show/hide categories
- **Interaction**: Works with all other filters (additive)

#### Data Side Toggles
- **Location**: Left side of controls
- **Options**: Source, Target
- **Purpose**: Show/hide left or right data columns
- **Use Case**: Focus on one side when needed

#### Column Visibility
- **Button**: "Columns ▼" dropdown (top right of controls)
- **Shows**: List of all columns with checkboxes
- **Behavior**: Click to show/hide individual columns
- **Affects**:
  - Table display
  - CSV export (only visible columns are exported)
  - Global search (only searches visible columns)

#### Per-Column Text Filters
- **Location**: Second row of table header (under column names)
- **Type**: Text input boxes
- **Behavior**: Case-insensitive partial match per column
- **Interaction**: Works with global search and status filters

### 5. Sorting

**Trigger**: Click on any column header

**Behavior**:
- **1st click**: Sort ascending (↑)
- **2nd click**: Sort descending (↓)
- **3rd click**: Clear sort (back to original order)

**Visual Indicators**:
- Default: `↕` (small, gray, low opacity)
- Active: `↑` or `↓` (bright, full opacity)
- Hover: Column header highlights

**Features**:
- Sort by Source OR Target columns independently
- Type-aware: Numbers sort numerically, strings alphabetically
- NULL handling: NULL values always go to end
- Case-sensitive for strings (uses `localeCompare`)

**Side Effects**:
- Clears row selection when sorting (row indices change)
- Preserved during filtering
- Reapplied after text filtering

### 6. Row Selection & CSV Export

**Location**: Bottom of table (below data rows)

#### Activation
- **Button**: "☑ Select Rows" (bottom left, always visible)
- **Toggle**: Click to enter/exit selection mode
- **Visual**: Button turns purple when active

#### Selection Mode UI
- Checkbox column appears on left of table
- Selection actions bar appears to right of button
- Shows: "X rows selected"
- Two export buttons appear:
  - "📋 Copy Left Side CSV" (green)
  - "📋 Copy Right Side CSV" (blue)

#### Export Behavior
1. User selects rows via checkboxes
2. Clicks "Copy Left Side CSV" or "Copy Right Side CSV"
3. CSV generated with:
   - **Only selected rows**
   - **Only visible columns** (respects column visibility settings)
   - **Only the chosen side** (left or right values)
   - Skips rows that don't exist on chosen side
4. CSV copied to clipboard automatically
5. Button shows "✓ Copied!" for 2 seconds

#### CSV Format
- Uses Papa Parse `unparse()` for proper CSV formatting
- Includes header row with column names
- Handles quotes, commas, and special characters correctly
- NULL/undefined values exported as empty strings

#### Smart Behaviors
- Export buttons disabled when no rows selected
- Selection cleared when filtering or sorting (indices change)
- Alerts if no rows selected or no visible columns
- Alerts if no data exists on chosen side for selected rows

### 7. Table Rendering

#### Column Structure
When both sides shown:
- [Checkbox] (if in selection mode)
- Source Col1 | Target Col1
- Source Col2 | Target Col2
- ...
- Status

When one side hidden:
- Only visible side columns shown
- Status column always shown

#### Cell Styling
- **Source cells**: Light purple background
- **Target cells**: Light teal background
- **Changed cells**: Yellow background (for "Different" rows)
- **Empty cells**: Gray background with "—" (row doesn't exist on this side)
- **NULL values**: Gray italic text "NULL"
- **Hover**: Row highlights

#### Status Icons
- Circular colored badges in rightmost column
- Equal: Green circle with "="
- Different: Red circle with "≠"
- Only Source: Blue circle with "L"
- Only Target: Orange circle with "R"

---

## Technical Architecture

### File Structure
```
┌─────────────────────────────────────────┐
│ HTML (Structure)                         │
│  - Data loading panels                   │
│  - Key selection UI                      │
│  - Comparison results table              │
│  - Selection/export controls             │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ CSS (Styling)                            │
│  - Modern gradient design                │
│  - Responsive layout                     │
│  - Interactive hover/focus states        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Papa Parse Library (Embedded)            │
│  - v5.4.1 (MIT License)                  │
│  - ~40KB minified                        │
│  - CSV parsing & generation              │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Application JavaScript                   │
│  - State management                      │
│  - Event handlers                        │
│  - Comparison algorithm                  │
│  - Rendering logic                       │
└─────────────────────────────────────────┘
```

### State Variables

```javascript
// Data state
let sourceData = null;           // Papa Parse result object
let targetData = null;           // Papa Parse result object
let comparisonResult = null;     // { columns: [], rows: [] }
let selectedKeyColumns = new Set(); // Set of column names

// Display state
let filteredRows = [];           // Currently displayed rows
let showSource = true;           // Show/hide left columns
let showTarget = true;           // Show/hide right columns
let visibleColumns = {};         // { colName: boolean }

// Sorting state
let currentSortColumn = null;    // Column name
let currentSortDirection = null; // 'asc' | 'desc'
let currentSortSide = null;      // 'source' | 'target'

// Selection state
let selectionMode = false;       // Selection mode active?
let selectedRows = new Set();    // Set of row indices
```

### Key Functions

#### Data Loading
- `handleFileUpload(side, file)` - File upload handler, shows preview
- `handlePaste(side)` - Manual paste handler
- `setupDragAndDrop()` - Initialize drag-and-drop listeners
- `updateStatus(side, status, message)` - Update status indicator
- `checkBothLoaded()` - Show key selection when both loaded

#### Key Selection
- `buildKeySelection()` - Generate key column checkboxes
- `toggleKeyColumn(field, wrapperEl)` - Toggle key selection
- `updateCompareButton()` - Enable/disable compare button

#### Comparison
- `performComparison()` - Main comparison algorithm
- `initializeComparison()` - Initialize comparison UI
- `resetAll()` - Clear all state and start over

#### Rendering
- `buildHeaders()` - Generate table headers with sort indicators
- `renderData()` - Render table rows
- `createRow(item, rowIndex)` - Create single table row
- `getStatusIcon(status)` - Get status badge text
- `getStatusClass(status)` - Get status CSS class

#### Filtering & Sorting
- `filterByStatus()` - Apply status category filters
- `applyTextFilters()` - Apply search and column filters
- `sortByColumn(columnName, side)` - Sort table by column
- `updateFilterCounts()` - Update count badges
- `updateStatistics()` - Update top stats bar

#### Column Visibility
- `initializeColumnVisibility()` - Setup column checkboxes
- `toggleColumnDropdown()` - Show/hide dropdown
- `toggleColumnVisibility(columnName)` - Toggle column

#### Selection & Export
- `toggleSelectionMode()` - Enter/exit selection mode
- `toggleRowSelection(rowIndex)` - Toggle row checkbox
- `updateSelectionCount()` - Update "X rows selected"
- `updateCopyButtons()` - Enable/disable export buttons
- `copySideAsCSV(side)` - Generate and copy CSV to clipboard

### Data Flow

```
1. File Load/Paste
   ↓
2. Papa Parse (CSV → JSON)
   ↓
3. Store in sourceData/targetData
   ↓
4. Show Key Selection UI
   ↓
5. User Selects Key(s)
   ↓
6. performComparison()
   - Build composite keys
   - Match rows by key
   - Classify: equal/different/left-only/right-only
   - Detect changed columns
   ↓
7. Store in comparisonResult
   ↓
8. Initialize UI
   - Build headers
   - Render rows
   - Setup filters
   ↓
9. User Interactions
   - Filter/Search → applyTextFilters()
   - Sort → sortByColumn()
   - Select → toggleSelectionMode()
   - Export → copySideAsCSV()
```

### Filter Chain

Filters are applied in this order (each narrows the result set):

1. **Status Filters** (Equal/Different/Only Source/Only Target)
2. **Global Search** (across all visible columns, with scope)
3. **Per-Column Text Filters** (AND logic across columns)
4. **Sorting** (if active, reapplied after filtering)

The `filteredRows` array always contains the final filtered/sorted result.

---

## Design Patterns

### Embedded Library Pattern
- Papa Parse library code embedded directly in `<script>` tags
- No CDN dependency
- File works offline
- Trade-off: Library doesn't auto-update (not a concern for stable CSV parsing)

### Declarative Rendering
- State changes trigger full re-render of affected components
- `buildHeaders()` + `renderData()` called after state changes
- Simple, predictable, no complex DOM diffing

### Set-Based Selection
- `selectedRows` uses Set (not array) for O(1) lookup
- Row indices used as keys (not row data references)
- Cleared when filtering/sorting changes indices

### Inline Event Handlers
- `onclick="functionName()"` used for simplicity
- Global functions (no encapsulation needed for standalone file)
- Easy to debug in browser console

### Progressive Enhancement
- Core features work without selection mode
- Selection mode adds layer on top
- Drag-and-drop enhances file upload (button still works)

---

## CSS Architecture

### Design System
- **Primary Color**: Purple gradient (`#667eea` to `#764ba2`)
- **Source Color**: Purple (`#6f42c1`)
- **Target Color**: Teal (`#20c997`)
- **Status Colors**:
  - Equal: Green (`#28a745`)
  - Different: Red (`#dc3545`)
  - Only Source: Blue (`#007bff`)
  - Only Target: Orange (`#fd7e14`)

### Layout Strategy
- **Flexbox** for control bars and action sections
- **Grid** for side-by-side data loading panels
- **Table** for comparison results (not CSS Grid - actual `<table>`)
- **Sticky header** for table (stays visible while scrolling)

### Responsive Design
- Breakpoint at `768px`
- Mobile: Side-by-side panels stack vertically
- Filter sections stack vertically on mobile

### Interactive States
- Hover: `transform: translateY(-1px)` + box-shadow
- Active: Background color change
- Focus: Border color + shadow ring
- Disabled: Gray background + no-pointer cursor

---

## Browser Compatibility

### Required Features
- ES6 (let/const, arrow functions, template literals, Set, Map)
- Clipboard API (`navigator.clipboard.writeText()`)
- File API (FileReader, drag-and-drop)
- Flexbox & Grid layout

### Tested/Supported Browsers
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

### Known Limitations
- IE11: Not supported (no ES6 support)
- Older Safari: May have issues with Clipboard API (requires HTTPS or localhost)

---

## Performance Considerations

### Optimization Strategies
- **No virtual scrolling**: Table renders all filtered rows
- **Reasonable for**: Up to ~10,000 filtered rows
- **Slow beyond**: ~50,000 rows (browser DOM limits)

### Performance Characteristics
- **File load**: Fast (Papa Parse is optimized)
- **Comparison**: O(n) where n = total rows (uses Map for O(1) lookups)
- **Filtering**: O(n) with string operations
- **Sorting**: O(n log n) using native sort
- **Rendering**: O(n) DOM operations (can be slow for large n)

### Memory Usage
- **Source data**: Stored in memory as parsed JSON
- **Target data**: Stored in memory as parsed JSON
- **Comparison result**: References to original data (minimal overhead)
- **Large files**: 100MB CSV → ~200-300MB memory (parsed + rendered)

---

## Edge Cases & Error Handling

### File Loading
- ✅ Empty files: Handled with error status
- ✅ Invalid CSV: Papa Parse errors shown to user
- ✅ No header row: Papa Parse auto-detects
- ✅ Inconsistent columns: All columns collected from both files
- ✅ Special characters: Handled by Papa Parse (quotes, commas, newlines)

### Key Selection
- ✅ No common columns: Error message shown, compare button disabled
- ✅ Duplicate keys: Last occurrence wins (Map overwrites)
- ✅ NULL in key: Converted to empty string in composite key

### Comparison
- ✅ Column in one file only: Shows as NULL in other side
- ✅ Same key, different values: Classified as "Different"
- ✅ NULL vs empty string: Treated as different values
- ✅ Type coercion: Papa Parse dynamic typing (can be issue if "1" vs 1)

### Filtering/Sorting
- ✅ Empty filter result: Table shows "no data"
- ✅ NULL values in sort: Always pushed to end
- ✅ Mixed types: Converted to string for comparison

### Selection/Export
- ✅ No visible columns: Alert shown, export blocked
- ✅ Row doesn't exist on side: Skipped in export
- ✅ Clipboard API failure: Error alert shown (may need HTTPS)

---

## Usage Workflow

### Basic Workflow
1. Open `csv_compare_standalone.html` in browser
2. Load source CSV (file/paste/drag)
3. Load target CSV (file/paste/drag)
4. Select one or more key columns
5. Click "Compare Data"
6. Review results with filters/search
7. (Optional) Select rows and export slice

### Advanced Workflow
1. Load data
2. Select keys
3. Compare
4. **Hide columns** you don't care about
5. **Filter by status** (e.g., only "Different")
6. **Search** for specific values
7. **Sort** by a column
8. **Select specific rows**
9. **Export left or right side** as CSV

---

## File Size & Dependencies

### File Size
- **Total**: ~75KB
- **Papa Parse**: ~40KB (minified)
- **HTML/CSS/JS**: ~35KB

### External Dependencies
- **None** - Completely self-contained
- No internet connection required
- No external libraries loaded at runtime

### Embedded Libraries
- **Papa Parse v5.4.1**
  - License: MIT
  - Purpose: CSV parsing and generation
  - URL: https://github.com/mholt/PapaParse
  - Embedded: Full minified source in `<script>` tag

---

## Security Considerations

### Safe Operations
- ✅ File parsing: Uses Papa Parse (well-tested library)
- ✅ No server communication: Everything client-side
- ✅ No eval() or innerHTML: All DOM created via createElement
- ✅ XSS prevention: Text content set via textContent (not innerHTML)

### User Privacy
- ✅ No data leaves the browser
- ✅ No analytics or tracking
- ✅ No cookies or local storage
- ✅ File data not persisted (lost on page refresh)

### Potential Issues
- ⚠️ Clipboard API: Requires HTTPS or localhost (browser security)
- ⚠️ Large files: Could cause browser tab to become unresponsive
- ⚠️ Memory: Very large files could crash browser tab

---

## Future Enhancement Ideas

### Performance
- Virtual scrolling for large datasets
- Web Worker for comparison algorithm
- IndexedDB for persistent storage

### Features
- Export filtered/sorted results (not just selected rows)
- Download CSV instead of clipboard copy
- Multiple file comparison (3+ files)
- Diff view (side-by-side with highlighted changes only)
- Save/load comparison configuration
- Regex support in text filters
- Column reordering (drag & drop)
- Row grouping/aggregation
- Export to Excel/JSON

### UX Improvements
- Keyboard shortcuts
- Undo/redo for state changes
- Column resizing
- Row height adjustment
- Dark mode
- Customizable color scheme
- Tour/tutorial for first-time users

### Technical
- TypeScript rewrite
- Component-based architecture (React/Vue)
- Unit tests
- End-to-end tests

---

## Troubleshooting

### Issue: "Failed to copy to clipboard"
**Cause**: Clipboard API requires HTTPS or localhost
**Solution**: Open file via `http://localhost` or deploy to HTTPS server

### Issue: Browser becomes slow/unresponsive
**Cause**: Too many rows being rendered
**Solution**: Use filters to reduce displayed rows, or split files

### Issue: Columns don't match between files
**Cause**: Different column names or order
**Solution**: Tool handles this - shows all columns, NULL for missing values

### Issue: Drag-and-drop not working
**Cause**: Browser security or file type
**Solution**: Use "Choose File" button instead, ensure .csv or .txt extension

### Issue: Preview warning stays after editing
**Cause**: Warning only removed when typing in textarea
**Solution**: Type something in the textarea to trigger warning removal

### Issue: Sort/filter cleared my selection
**Cause**: By design - row indices change when filtering/sorting
**Solution**: Apply filters/sort first, then select rows

---

## Code Maintenance Guidelines

### Adding New Features
1. Add state variables at top
2. Add styles in `<style>` section
3. Add HTML in appropriate section
4. Add functions after existing related functions
5. Update initialization in `initializeComparison()`
6. Update reset in `resetAll()`
7. Test with large files (>10,000 rows)

### Modifying Comparison Logic
- **Location**: `performComparison()` function
- **Test**: Different status combinations, NULL values, duplicate keys
- **Impact**: Changes affect entire comparison result

### Modifying Filters
- **Location**: `applyTextFilters()` function
- **Remember**: Maintain filter chain order
- **Clear selection**: Add `selectedRows.clear()` if indices change

### Styling Changes
- **Maintain**: Purple/teal color scheme for consistency
- **Test**: Responsive breakpoint at 768px
- **Check**: Hover states, focus rings, disabled states

---

## Version History

### Current Version (Latest)
**Features**:
- ✅ Drag & drop file upload
- ✅ File preview (first 20 rows)
- ✅ Row selection & export
- ✅ Column sorting (3-state)
- ✅ Global search with scope filters
- ✅ Per-column text filters
- ✅ Column visibility toggle
- ✅ Status category filters
- ✅ Side toggle (show/hide source/target)
- ✅ Composite key support
- ✅ Embedded Papa Parse (no CDN)

### Development Timeline
1. **Base template**: Side-by-side comparison from `data_compare.html`
2. **CSV loading**: File upload + paste functionality
3. **Key selection**: Multi-select composite key UI
4. **Comparison algorithm**: Map-based matching
5. **Sorting**: 3-state column sorting with indicators
6. **Selection mode**: Checkbox column + CSV export
7. **Drag & drop**: File drop zones
8. **File preview**: Show first 20 rows + warning

---

## Related Files

### Source Template
- `src/templates/data_compare.html` - Original database comparison template
- Used as design/UI foundation
- This tool is a complete rewrite with different data source (CSV vs DB)

### Configuration Files
- None - This is a standalone tool with no configuration

### Generated Files
- None - All comparison happens in memory, no files written

---

## Contact & Support

This is a standalone tool with no formal support channel. For issues or enhancements:
1. Review this documentation
2. Check browser console for JavaScript errors
3. Test with smaller files first
4. Verify file format is valid CSV

---

## License

This tool embeds **Papa Parse v5.4.1** which is MIT licensed.

The rest of the code follows the license of the parent project (ContextFreeSQL).

---

## Quick Reference

### Keyboard Shortcuts
- None currently implemented (future enhancement)

### File Limits
- **Recommended**: < 10,000 rows per file
- **Maximum**: Limited by browser memory (~100MB files)
- **Preview**: Shows first 20 rows only

### Export Format
- CSV with header row
- Comma-delimited
- Quoted fields (when necessary)
- NULL → empty string

### Status Categories
- **Equal** (=): All values match
- **Different** (≠): Row exists in both, values differ
- **Only Source** (L): Key only in source file
- **Only Target** (R): Key only in target file

### Color Coding
- **Purple**: Source/Left data
- **Teal**: Target/Right data
- **Yellow**: Changed cells
- **Green**: Equal status
- **Red**: Different status
- **Blue**: Only Source status
- **Orange**: Only Target status

---

**End of Documentation**
