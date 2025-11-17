// ============================================
// CONFIGURATION VARIABLES
// ============================================

const CONFIG = {
    reportTitle: "Table Data Comparison Report",
    tableName: "students",
    sourceLabel: "Source",
    targetLabel: "Target"
};

// Sample data structure for development/testing:
const sampleReportData = {
    columns: ["student_id", "first_name", "last_name", "email", "grade", "enrollment_date"],
    rows: [
        {
            status: "equal",
            leftValues: {
                student_id: 1,
                first_name: "John",
                last_name: "Doe",
                email: "john.doe@email.com",
                grade: "A",
                enrollment_date: "2023-01-15"
            },
            rightValues: {
                student_id: 1,
                first_name: "John",
                last_name: "Doe",
                email: "john.doe@email.com",
                grade: "A",
                enrollment_date: "2023-01-15"
            },
            changedColumns: []
        },
        {
            status: "different",
            leftValues: {
                student_id: 2,
                first_name: "Jane",
                last_name: "Smith",
                email: "jane.smith@email.com",
                grade: "B",
                enrollment_date: "2023-02-20"
            },
            rightValues: {
                student_id: 2,
                first_name: "Jane",
                last_name: "Smith",
                email: "jane.smith.new@email.com",
                grade: "A",
                enrollment_date: "2023-02-20"
            },
            changedColumns: ["email", "grade"]
        },
        {
            status: "left-only",
            leftValues: {
                student_id: 3,
                first_name: "Bob",
                last_name: "Johnson",
                email: "bob.j@email.com",
                grade: "C",
                enrollment_date: "2023-03-10"
            },
            rightValues: null,
            changedColumns: []
        },
        {
            status: "right-only",
            leftValues: null,
            rightValues: {
                student_id: 4,
                first_name: "Alice",
                last_name: "Williams",
                email: "alice.w@email.com",
                grade: "A",
                enrollment_date: "2023-04-05"
            },
            changedColumns: []
        },
        {
            status: "different",
            leftValues: {
                student_id: 5,
                first_name: "Charlie",
                last_name: "Brown",
                email: "charlie.b@email.com",
                grade: null,
                enrollment_date: "2023-05-12"
            },
            rightValues: {
                student_id: 5,
                first_name: "Charlie",
                last_name: "Brown",
                email: "charlie.b@email.com",
                grade: "B",
                enrollment_date: "2023-05-12"
            },
            changedColumns: ["grade"]
        }
    ]
};

// Report data - replace [[reportInfo]] with actual data from PostgreSQL
// Format: { columns: ["col1", "col2", ...], rows: [...] }
let reportData;
try {
    reportData = [[reportInfo]];
} catch (e) {
    reportData = null; // Placeholder not replaced yet, use sample data
}

// Use sample data if reportData is a placeholder
const actualData = (!reportData || typeof reportData === 'string' || reportData.length === 0)
    ? sampleReportData
    : reportData;

// ============================================
// APPLICATION CODE
// ============================================

let filteredRows = [...actualData.rows];
let showSource = true;
let showTarget = true;

function getStatusIcon(status) {
    const icons = {
        'equal': '=',
        'left-only': 'L',
        'right-only': 'R',
        'different': '≠'
    };
    return icons[status] || '?';
}

function getStatusClass(status) {
    return `status-${status}`;
}

function buildHeaders() {
    const thead = document.getElementById('tableHeaders');
    thead.innerHTML = '';

    // Column name row
    const headerRow = document.createElement('tr');

    actualData.columns.forEach(col => {
        if (showSource) {
            const th = document.createElement('th');
            th.className = 'source-header';
            th.textContent = col;
            th.title = `${CONFIG.sourceLabel}: ${col}`;
            headerRow.appendChild(th);
        }

        if (showTarget) {
            const th = document.createElement('th');
            th.className = 'target-header';
            th.textContent = col;
            th.title = `${CONFIG.targetLabel}: ${col}`;
            headerRow.appendChild(th);
        }
    });

    // Status column
    const statusTh = document.createElement('th');
    statusTh.className = 'status-header';
    statusTh.textContent = 'Status';
    headerRow.appendChild(statusTh);

    thead.appendChild(headerRow);

    // Filter row
    const filterRow = document.createElement('tr');
    filterRow.className = 'filter-row';

    actualData.columns.forEach((col, index) => {
        if (showSource) {
            const th = document.createElement('th');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'filter-input';
            input.placeholder = `Filter...`;
            input.id = `filter-source-${index}`;
            input.onkeyup = filterData;
            th.appendChild(input);
            filterRow.appendChild(th);
        }

        if (showTarget) {
            const th = document.createElement('th');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'filter-input';
            input.placeholder = `Filter...`;
            input.id = `filter-target-${index}`;
            input.onkeyup = filterData;
            th.appendChild(input);
            filterRow.appendChild(th);
        }
    });

    // Empty filter cell for status column
    const emptyTh = document.createElement('th');
    filterRow.appendChild(emptyTh);

    thead.appendChild(filterRow);
}

function renderData() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    filteredRows.forEach(item => {
        const row = createRow(item);
        tbody.appendChild(row);
    });

    updateStatistics();
}

function createRow(item) {
    const row = document.createElement('tr');

    actualData.columns.forEach(col => {
        if (showSource) {
            const td = document.createElement('td');
            td.className = 'source-cell';

            if (item.leftValues === null) {
                td.classList.add('empty-cell');
                td.textContent = '—';
            } else {
                const value = item.leftValues[col];
                if (value === null || value === undefined) {
                    td.classList.add('null-value');
                    td.textContent = 'NULL';
                } else {
                    td.textContent = value;
                }

                if (item.changedColumns.includes(col)) {
                    td.classList.add('changed');
                }
            }

            row.appendChild(td);
        }

        if (showTarget) {
            const td = document.createElement('td');
            td.className = 'target-cell';

            if (item.rightValues === null) {
                td.classList.add('empty-cell');
                td.textContent = '—';
            } else {
                const value = item.rightValues[col];
                if (value === null || value === undefined) {
                    td.classList.add('null-value');
                    td.textContent = 'NULL';
                } else {
                    td.textContent = value;
                }

                if (item.changedColumns.includes(col)) {
                    td.classList.add('changed');
                }
            }

            row.appendChild(td);
        }
    });

    // Status cell
    const statusTd = document.createElement('td');
    statusTd.className = 'status-cell';
    const statusIcon = document.createElement('div');
    statusIcon.className = `status-icon ${getStatusClass(item.status)}`;
    statusIcon.textContent = getStatusIcon(item.status);
    statusTd.appendChild(statusIcon);
    row.appendChild(statusTd);

    return row;
}

function toggleSides() {
    showSource = document.getElementById('showSource').checked;
    showTarget = document.getElementById('showTarget').checked;

    buildHeaders();
    applyTextFilters(); // This will update counts and render
}

function filterByStatus() {
    const equalChecked = document.getElementById('equal').checked;
    const leftOnlyChecked = document.getElementById('leftOnly').checked;
    const rightOnlyChecked = document.getElementById('rightOnly').checked;
    const differentChecked = document.getElementById('different').checked;

    filteredRows = actualData.rows.filter(item => {
        switch(item.status) {
            case 'equal': return equalChecked;
            case 'left-only': return leftOnlyChecked;
            case 'right-only': return rightOnlyChecked;
            case 'different': return differentChecked;
            default: return true;
        }
    });

    applyTextFilters();
}

function filterData() {
    applyTextFilters();
}

function applyTextFilters() {
    // Get status filters
    const equalChecked = document.getElementById('equal').checked;
    const leftOnlyChecked = document.getElementById('leftOnly').checked;
    const rightOnlyChecked = document.getElementById('rightOnly').checked;
    const differentChecked = document.getElementById('different').checked;

    const statusFiltered = actualData.rows.filter(item => {
        switch(item.status) {
            case 'equal': return equalChecked;
            case 'left-only': return leftOnlyChecked;
            case 'right-only': return rightOnlyChecked;
            case 'different': return differentChecked;
            default: return true;
        }
    });

    // Get global search filter
    const globalSearchInput = document.getElementById('globalSearch');
    const globalSearch = globalSearchInput ? globalSearchInput.value.toLowerCase() : '';

    // Get per-column text filters
    const sourceFilters = actualData.columns.map((col, index) => {
        const input = document.getElementById(`filter-source-${index}`);
        return input ? input.value.toLowerCase() : '';
    });

    const targetFilters = actualData.columns.map((col, index) => {
        const input = document.getElementById(`filter-target-${index}`);
        return input ? input.value.toLowerCase() : '';
    });

    // Apply text filters
    filteredRows = statusFiltered.filter(item => {
        // Global search: check if ANY field contains the search text
        if (globalSearch) {
            let globalMatch = false;

            // Search in source values
            if (item.leftValues !== null) {
                for (const col of actualData.columns) {
                    const value = item.leftValues[col];
                    if (value !== null && value !== undefined &&
                        String(value).toLowerCase().includes(globalSearch)) {
                        globalMatch = true;
                        break;
                    }
                }
            }

            // Search in target values if not found in source
            if (!globalMatch && item.rightValues !== null) {
                for (const col of actualData.columns) {
                    const value = item.rightValues[col];
                    if (value !== null && value !== undefined &&
                        String(value).toLowerCase().includes(globalSearch)) {
                        globalMatch = true;
                        break;
                    }
                }
            }

            if (!globalMatch) return false;
        }

        // Check per-column source filters
        const sourceMatch = !showSource || sourceFilters.every((filter, index) => {
            if (!filter) return true;
            if (item.leftValues === null) return false;
            const col = actualData.columns[index];
            const value = item.leftValues[col];
            return value !== null && value !== undefined &&
                   String(value).toLowerCase().includes(filter);
        });

        // Check per-column target filters
        const targetMatch = !showTarget || targetFilters.every((filter, index) => {
            if (!filter) return true;
            if (item.rightValues === null) return false;
            const col = actualData.columns[index];
            const value = item.rightValues[col];
            return value !== null && value !== undefined &&
                   String(value).toLowerCase().includes(filter);
        });

        return sourceMatch && targetMatch;
    });

    updateFilterCounts();
    renderData();
}

function updateFilterCounts() {
    // Count currently visible rows by status
    const counts = {
        equal: 0,
        'left-only': 0,
        'right-only': 0,
        different: 0
    };

    filteredRows.forEach(row => {
        counts[row.status]++;
    });

    // Update count badges
    document.getElementById('countEqual').textContent = counts.equal;
    document.getElementById('countLeftOnly').textContent = counts['left-only'];
    document.getElementById('countRightOnly').textContent = counts['right-only'];
    document.getElementById('countDifferent').textContent = counts.different;
}

function updateStatistics() {
    const stats = {
        equal: 0,
        different: 0,
        'left-only': 0,
        'right-only': 0
    };

    actualData.rows.forEach(row => {
        stats[row.status]++;
    });

    document.getElementById('statEqual').textContent = stats.equal;
    document.getElementById('statDifferent').textContent = stats.different;
    document.getElementById('statLeftOnly').textContent = stats['left-only'];
    document.getElementById('statRightOnly').textContent = stats['right-only'];
}

// Initialize
document.getElementById('currentDate').textContent = new Date().toLocaleDateString();
document.getElementById('reportTitle').textContent = CONFIG.reportTitle;
document.getElementById('tableName').textContent = CONFIG.tableName;

buildHeaders();
updateFilterCounts(); // Initialize counts
renderData();
