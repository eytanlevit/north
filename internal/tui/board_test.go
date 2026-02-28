package tui

import (
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testIssues() []*model.Issue {
	return []*model.Issue{
		{Meta: model.IssueMeta{ID: "NOR-1", Title: "First issue", Status: "todo", Priority: "high"}},
		{Meta: model.IssueMeta{ID: "NOR-2", Title: "Second issue", Status: "in-progress", Priority: "medium"}},
		{Meta: model.IssueMeta{ID: "NOR-3", Title: "Third issue", Status: "done", Priority: "low"}},
		{Meta: model.IssueMeta{ID: "NOR-4", Title: "Fourth issue", Status: "todo", Priority: "critical"}},
	}
}

func TestColumnWidths(t *testing.T) {
	tests := []struct {
		name       string
		totalWidth int
		numCols    int
		wantWidth  int
	}{
		{"standard 3 cols 120w", 120, 3, 39},  // (120-2)/3 = 39
		{"standard 3 cols 80w", 80, 3, 26},     // (80-2)/3 = 26
		{"2 cols 100w", 100, 2, 49},            // (100-1)/2 = 49
		{"1 col 80w", 80, 1, 80},               // (80-0)/1 = 80
		{"narrow 40w 3 cols", 40, 3, 12},       // (40-2)/3 = 12
		{"very narrow 20w 3 cols", 20, 3, 6},   // (20-2)/3 = 6
		{"zero cols", 80, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ColumnWidths(tt.totalWidth, tt.numCols)
			assert.Equal(t, tt.wantWidth, got)
		})
	}
}

func TestGroupIssuesByStatus(t *testing.T) {
	statuses := []string{"todo", "in-progress", "done"}
	issues := testIssues()

	groups := GroupIssuesByStatus(issues, statuses)

	assert.Len(t, groups["todo"], 2)
	assert.Len(t, groups["in-progress"], 1)
	assert.Len(t, groups["done"], 1)

	// Verify correct issues in each group.
	assert.Equal(t, "NOR-1", groups["todo"][0].Meta.ID)
	assert.Equal(t, "NOR-4", groups["todo"][1].Meta.ID)
	assert.Equal(t, "NOR-2", groups["in-progress"][0].Meta.ID)
	assert.Equal(t, "NOR-3", groups["done"][0].Meta.ID)
}

func TestGroupIssuesByStatus_UnknownStatus(t *testing.T) {
	statuses := []string{"todo", "done"}
	issues := []*model.Issue{
		{Meta: model.IssueMeta{ID: "NOR-1", Status: "todo"}},
		{Meta: model.IssueMeta{ID: "NOR-2", Status: "unknown"}}, // not in statuses
	}

	groups := GroupIssuesByStatus(issues, statuses)

	assert.Len(t, groups["todo"], 1)
	assert.Len(t, groups["done"], 0)
	// "unknown" issue is dropped — no crash.
	_, exists := groups["unknown"]
	assert.False(t, exists)
}

func TestGroupIssuesByStatus_Empty(t *testing.T) {
	statuses := []string{"todo", "in-progress", "done"}
	groups := GroupIssuesByStatus(nil, statuses)

	for _, s := range statuses {
		assert.NotNil(t, groups[s], "group for %q should be non-nil empty slice", s)
		assert.Len(t, groups[s], 0)
	}
}

func TestBoardModel_Navigation(t *testing.T) {
	statuses := []string{"todo", "in-progress", "done"}
	board := NewBoardModel(statuses)
	board.SetSize(120, 40)
	board.SetIssues(testIssues())

	// Start at col 0, cursor 0.
	assert.Equal(t, 0, board.focusedCol)
	assert.Equal(t, 0, board.cursors[0])

	// Move down in todo column (has 2 issues).
	board.MoveDown()
	assert.Equal(t, 1, board.cursors[0])

	// Move down again — should clamp at last item.
	board.MoveDown()
	assert.Equal(t, 1, board.cursors[0])

	// Move up.
	board.MoveUp()
	assert.Equal(t, 0, board.cursors[0])

	// Move up again — should clamp at 0.
	board.MoveUp()
	assert.Equal(t, 0, board.cursors[0])

	// Move right to in-progress.
	board.MoveRight()
	assert.Equal(t, 1, board.focusedCol)

	// Move right to done.
	board.MoveRight()
	assert.Equal(t, 2, board.focusedCol)

	// Move right again — should clamp.
	board.MoveRight()
	assert.Equal(t, 2, board.focusedCol)

	// Move left.
	board.MoveLeft()
	assert.Equal(t, 1, board.focusedCol)

	// All the way left — clamp at 0.
	board.MoveLeft()
	board.MoveLeft()
	assert.Equal(t, 0, board.focusedCol)
}

func TestBoardModel_SelectedIssue(t *testing.T) {
	board := NewBoardModel([]string{"todo", "done"})
	board.SetSize(80, 40)

	// No issues — selected should be nil.
	assert.Nil(t, board.SelectedIssue())

	board.SetIssues([]*model.Issue{
		{Meta: model.IssueMeta{ID: "NOR-1", Status: "todo", Priority: "high"}},
		{Meta: model.IssueMeta{ID: "NOR-2", Status: "done", Priority: "low"}},
	})

	selected := board.SelectedIssue()
	require.NotNil(t, selected)
	assert.Equal(t, "NOR-1", selected.Meta.ID)

	// Navigate to done column.
	board.MoveRight()
	selected = board.SelectedIssue()
	require.NotNil(t, selected)
	assert.Equal(t, "NOR-2", selected.Meta.ID)
}

func TestBoardModel_EmptyColumn(t *testing.T) {
	board := NewBoardModel([]string{"todo", "in-progress", "done"})
	board.SetSize(120, 40)
	board.SetIssues([]*model.Issue{
		{Meta: model.IssueMeta{ID: "NOR-1", Status: "todo", Priority: "high"}},
		// in-progress is empty
		{Meta: model.IssueMeta{ID: "NOR-2", Status: "done", Priority: "low"}},
	})

	// Navigate to empty in-progress column.
	board.MoveRight()
	assert.Equal(t, 1, board.focusedCol)
	assert.Nil(t, board.SelectedIssue())

	// Move up/down in empty column — no crash.
	board.MoveUp()
	board.MoveDown()
	assert.Nil(t, board.SelectedIssue())
}

func TestBoardModel_CursorRestoration(t *testing.T) {
	board := NewBoardModel([]string{"todo", "done"})
	board.SetSize(80, 40)

	issues := []*model.Issue{
		{Meta: model.IssueMeta{ID: "NOR-1", Status: "todo", Priority: "high", Title: "A"}},
		{Meta: model.IssueMeta{ID: "NOR-2", Status: "todo", Priority: "medium", Title: "B"}},
		{Meta: model.IssueMeta{ID: "NOR-3", Status: "todo", Priority: "low", Title: "C"}},
	}
	board.SetIssues(issues)

	// Select NOR-2.
	board.MoveDown()
	assert.Equal(t, "NOR-2", board.SelectedIssue().Meta.ID)

	// Reload with same issues — cursor should restore to NOR-2.
	board.SetIssues(issues)
	assert.Equal(t, "NOR-2", board.SelectedIssue().Meta.ID)

	// Reload after NOR-2 removed — cursor should clamp.
	board.SetIssues([]*model.Issue{
		{Meta: model.IssueMeta{ID: "NOR-1", Status: "todo", Priority: "high", Title: "A"}},
		{Meta: model.IssueMeta{ID: "NOR-3", Status: "todo", Priority: "low", Title: "C"}},
	})
	selected := board.SelectedIssue()
	require.NotNil(t, selected)
	// Cursor was at index 1 (NOR-2), NOR-2 is gone, so should clamp to index 1 (NOR-3).
	assert.Equal(t, "NOR-3", selected.Meta.ID)
}

func TestBoardModel_View(t *testing.T) {
	board := NewBoardModel([]string{"todo", "in-progress", "done"})
	board.SetSize(120, 30)
	board.SetIssues(testIssues())

	view := board.View()

	// Should contain column headers and issue IDs.
	assert.Contains(t, view, "TODO")
	assert.Contains(t, view, "IN-PROGRESS")
	assert.Contains(t, view, "DONE")
	assert.Contains(t, view, "NOR-1")
	assert.Contains(t, view, "NOR-2")
}

func TestBoardModel_NoStatuses(t *testing.T) {
	board := NewBoardModel(nil)
	board.SetSize(80, 30)
	view := board.View()
	assert.Contains(t, view, "No statuses configured")
}

func TestTruncate(t *testing.T) {
	assert.Equal(t, "hello", truncate("hello", 10))
	assert.Equal(t, "hel...", truncate("hello world", 6))
	assert.Equal(t, "hel", truncate("hello", 3))
	assert.Equal(t, "", truncate("hello", 0))
	assert.Equal(t, "hello world", truncate("hello world", 100))
}

func TestPriorityIndicator(t *testing.T) {
	// Just verify they return non-empty strings and don't panic.
	for _, p := range []string{"critical", "high", "medium", "low", "unknown"} {
		result := PriorityIndicator(p)
		assert.NotEmpty(t, result, "priority %q should render", p)
	}
}
