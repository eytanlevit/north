package tui

import (
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
)

func TestDetailModel_View(t *testing.T) {
	detail := NewDetailModel()
	detail.SetSize(80, 40)

	issue := &model.Issue{
		Meta: model.IssueMeta{
			ID:       "NOR-1",
			Title:    "Test issue",
			Status:   "todo",
			Priority: "high",
			Labels:   []string{"bug", "ui"},
			Created:  "2026-02-28",
			Updated:  "2026-02-28",
		},
		Body: "This is the issue body.",
	}
	detail.SetIssue(issue)

	view := detail.View()

	assert.Contains(t, view, "NOR-1")
	assert.Contains(t, view, "Test issue")
	assert.Contains(t, view, "todo")
	assert.Contains(t, view, "high")
	assert.Contains(t, view, "bug, ui")
	assert.Contains(t, view, "2026-02-28")
}

func TestDetailModel_NilIssue(t *testing.T) {
	detail := NewDetailModel()
	detail.SetSize(80, 40)

	view := detail.View()
	assert.Contains(t, view, "No issue selected")
}

func TestDetailModel_WithComments(t *testing.T) {
	detail := NewDetailModel()
	detail.SetSize(80, 40)

	issue := &model.Issue{
		Meta: model.IssueMeta{
			ID:       "NOR-1",
			Title:    "Issue with comments",
			Status:   "todo",
			Priority: "medium",
			Created:  "2026-02-28",
			Updated:  "2026-02-28",
			Comments: []model.Comment{
				{Author: "alice", Date: "2026-02-28", Body: "Looks good"},
				{Author: "bob", Date: "2026-02-28", Body: "Needs work"},
			},
		},
		Body: "Body text.",
	}
	detail.SetIssue(issue)

	view := detail.View()
	assert.Contains(t, view, "Comments (2)")
	assert.Contains(t, view, "alice")
	assert.Contains(t, view, "bob")
}

func TestDetailModel_WithParentAndBlockedBy(t *testing.T) {
	detail := NewDetailModel()
	detail.SetSize(80, 40)

	issue := &model.Issue{
		Meta: model.IssueMeta{
			ID:        "NOR-3",
			Title:     "Child issue",
			Status:    "todo",
			Priority:  "low",
			Parent:    "NOR-1",
			BlockedBy: []string{"NOR-2"},
			Created:   "2026-02-28",
			Updated:   "2026-02-28",
		},
	}
	detail.SetIssue(issue)

	view := detail.View()
	assert.Contains(t, view, "Parent")
	assert.Contains(t, view, "NOR-1")
	assert.Contains(t, view, "Blocked by")
	assert.Contains(t, view, "NOR-2")
}

func TestWordWrap(t *testing.T) {
	tests := []struct {
		name  string
		input string
		width int
		want  string
	}{
		{"short line", "hello", 80, "hello"},
		{"exact width", "hello", 5, "hello"},
		{"wrap needed", "hello world foo", 11, "hello\nworld foo"},
		{"zero width", "hello", 0, "hello"},
		{"multiline input", "line one\nline two", 80, "line one\nline two"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := wordWrap(tt.input, tt.width)
			assert.Equal(t, tt.want, got)
		})
	}
}
