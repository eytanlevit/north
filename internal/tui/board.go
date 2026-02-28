package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/eytanlevit/north/internal/model"
)

// column holds issues for a single status.
type column struct {
	status string
	issues []*model.Issue
}

// BoardModel is the kanban board view.
type BoardModel struct {
	columns    []column
	focusedCol int
	cursors    []int // one cursor per column
	width      int
	height     int
}

// NewBoardModel creates a new board with the given statuses.
func NewBoardModel(statuses []string) BoardModel {
	cols := make([]column, len(statuses))
	cursors := make([]int, len(statuses))
	for i, s := range statuses {
		cols[i] = column{status: s, issues: []*model.Issue{}}
	}
	return BoardModel{
		columns: cols,
		cursors: cursors,
	}
}

// SetSize updates the board dimensions.
func (b *BoardModel) SetSize(w, h int) {
	b.width = w
	b.height = h
}

// SetIssues distributes issues across columns by status.
// Preserves cursor position by issue ID where possible.
func (b *BoardModel) SetIssues(issues []*model.Issue) {
	// Save currently selected issue IDs for cursor restoration.
	selectedIDs := make([]string, len(b.columns))
	for i, col := range b.columns {
		if b.cursors[i] < len(col.issues) {
			selectedIDs[i] = col.issues[b.cursors[i]].Meta.ID
		}
	}

	// Build status->column index for O(1) lookup.
	statusIdx := make(map[string]int, len(b.columns))
	for i, col := range b.columns {
		statusIdx[col.status] = i
		b.columns[i].issues = []*model.Issue{}
	}

	for _, issue := range issues {
		if idx, ok := statusIdx[issue.Meta.Status]; ok {
			b.columns[idx].issues = append(b.columns[idx].issues, issue)
		}
	}

	// Restore cursors by ID, or clamp.
	for i, col := range b.columns {
		restored := false
		if selectedIDs[i] != "" {
			for j, issue := range col.issues {
				if issue.Meta.ID == selectedIDs[i] {
					b.cursors[i] = j
					restored = true
					break
				}
			}
		}
		if !restored {
			b.cursors[i] = clamp(b.cursors[i], 0, max(0, len(col.issues)-1))
		}
	}
}

// SelectedIssue returns the currently highlighted issue, or nil.
func (b *BoardModel) SelectedIssue() *model.Issue {
	col := b.columns[b.focusedCol]
	if len(col.issues) == 0 {
		return nil
	}
	return col.issues[b.cursors[b.focusedCol]]
}

// MoveUp moves the cursor up in the focused column.
func (b *BoardModel) MoveUp() {
	col := b.columns[b.focusedCol]
	if len(col.issues) == 0 {
		return
	}
	b.cursors[b.focusedCol] = max(0, b.cursors[b.focusedCol]-1)
}

// MoveDown moves the cursor down in the focused column.
func (b *BoardModel) MoveDown() {
	col := b.columns[b.focusedCol]
	if len(col.issues) == 0 {
		return
	}
	b.cursors[b.focusedCol] = min(len(col.issues)-1, b.cursors[b.focusedCol]+1)
}

// MoveLeft moves focus to the previous column.
func (b *BoardModel) MoveLeft() {
	if b.focusedCol > 0 {
		b.focusedCol--
	}
}

// MoveRight moves focus to the next column.
func (b *BoardModel) MoveRight() {
	if b.focusedCol < len(b.columns)-1 {
		b.focusedCol++
	}
}

// ColumnWidths calculates the width for each column given total width.
func ColumnWidths(totalWidth, numColumns int) int {
	if numColumns <= 0 {
		return 0
	}
	// Account for column borders (2 chars each) and gaps (1 char between).
	gaps := numColumns - 1
	available := totalWidth - gaps
	if available < numColumns {
		return 1
	}
	return available / numColumns
}

// View renders the board.
func (b *BoardModel) View() string {
	if len(b.columns) == 0 {
		return emptyStyle.Render("No statuses configured.")
	}

	colWidth := ColumnWidths(b.width, len(b.columns))
	// Inner width = colWidth minus border (2) and padding (2).
	innerWidth := max(1, colWidth-4)

	// Reserve space: 1 line for help bar.
	availableHeight := max(3, b.height-2)

	cols := make([]string, len(b.columns))
	for i, col := range b.columns {
		isFocused := i == b.focusedCol

		// Column title.
		title := strings.ToUpper(col.status)
		countStr := fmt.Sprintf(" (%d)", len(col.issues))
		title = truncate(title+countStr, innerWidth)

		var titleStr string
		if isFocused {
			titleStr = focusedColumnTitleStyle.Width(innerWidth).Render(title)
		} else {
			titleStr = columnTitleStyle.Width(innerWidth).Render(title)
		}

		// Cards.
		var cards []string
		for j, issue := range col.issues {
			isSelected := isFocused && j == b.cursors[i]
			cards = append(cards, renderCard(issue, innerWidth, isSelected))
		}

		if len(cards) == 0 {
			cards = append(cards, emptyStyle.Width(innerWidth).Render("No issues"))
		}

		content := titleStr + "\n" + strings.Join(cards, "\n")

		// Column height (inner) = available minus border (2).
		colHeight := max(1, availableHeight-2)

		var colStr string
		if isFocused {
			colStr = focusedColumnStyle.Width(colWidth - 2).Height(colHeight).Render(content)
		} else {
			colStr = columnStyle.Width(colWidth - 2).Height(colHeight).Render(content)
		}
		cols[i] = colStr
	}

	return lipgloss.JoinHorizontal(lipgloss.Top, cols...)
}

// GroupIssuesByStatus distributes issues into buckets keyed by status.
// Returns a map and preserves the order from the statuses slice.
func GroupIssuesByStatus(issues []*model.Issue, statuses []string) map[string][]*model.Issue {
	groups := make(map[string][]*model.Issue, len(statuses))
	for _, s := range statuses {
		groups[s] = []*model.Issue{}
	}
	for _, issue := range issues {
		if _, ok := groups[issue.Meta.Status]; ok {
			groups[issue.Meta.Status] = append(groups[issue.Meta.Status], issue)
		}
	}
	return groups
}

func renderCard(issue *model.Issue, width int, selected bool) string {
	priority := PriorityIndicator(issue.Meta.Priority)
	id := cardIDStyle.Render(issue.Meta.ID)
	title := truncate(issue.Meta.Title, max(1, width-4))

	line := fmt.Sprintf("%s %s %s", priority, id, title)

	if selected {
		return selectedCardStyle.Width(width).Render(line)
	}
	return cardStyle.Width(width).Render(line)
}

func truncate(s string, maxLen int) string {
	if maxLen <= 0 {
		return ""
	}
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

func clamp(val, lo, hi int) int {
	if val < lo {
		return lo
	}
	if val > hi {
		return hi
	}
	return val
}
