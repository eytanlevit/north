package render

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIssueTable_Empty(t *testing.T) {
	var buf bytes.Buffer
	IssueTable(&buf, []*model.Issue{})
	assert.Equal(t, "No issues found.\n", buf.String())
}

func TestIssueTable_SingleIssue(t *testing.T) {
	var buf bytes.Buffer
	issues := []*model.Issue{
		{
			Meta: model.IssueMeta{
				ID:       "NOR-1",
				Title:    "Test issue",
				Status:   "todo",
				Priority: "high",
				Labels:   []string{"bug", "frontend"},
			},
		},
	}
	IssueTable(&buf, issues)

	out := buf.String()
	assert.Contains(t, out, "ID")
	assert.Contains(t, out, "STATUS")
	assert.Contains(t, out, "NOR-1")
	assert.Contains(t, out, "todo")
	assert.Contains(t, out, "high")
	assert.Contains(t, out, "Test issue")
	assert.Contains(t, out, "bug, frontend")
}

func TestIssueTable_NoLabels(t *testing.T) {
	var buf bytes.Buffer
	issues := []*model.Issue{
		{
			Meta: model.IssueMeta{
				ID:       "NOR-1",
				Title:    "No labels",
				Status:   "done",
				Priority: "low",
			},
		},
	}
	IssueTable(&buf, issues)

	out := buf.String()
	assert.Contains(t, out, "NOR-1")
	// Labels column should be empty but not cause errors
	lines := strings.Split(strings.TrimSpace(out), "\n")
	assert.Len(t, lines, 2, "should have header + 1 data row")
}

func TestIssueDetail_Full(t *testing.T) {
	var buf bytes.Buffer
	issue := &model.Issue{
		Meta: model.IssueMeta{
			ID:        "NOR-1",
			Title:     "Full issue",
			Status:    "in-progress",
			Priority:  "high",
			Labels:    []string{"auth", "backend"},
			Parent:    "NOR-0",
			BlockedBy: []string{"NOR-2", "NOR-3"},
			Created:   "2026-02-28",
			Updated:   "2026-02-28",
			Comments: []model.Comment{
				{Author: "alice", Date: "2026-02-28", Body: "Working on it."},
			},
		},
		Body: "## Description\n\nSome description.\n",
	}
	IssueDetail(&buf, issue)

	out := buf.String()
	assert.Contains(t, out, "ID:       NOR-1")
	assert.Contains(t, out, "Title:    Full issue")
	assert.Contains(t, out, "Status:   in-progress")
	assert.Contains(t, out, "Priority: high")
	assert.Contains(t, out, "Labels:   auth, backend")
	assert.Contains(t, out, "Parent:   NOR-0")
	assert.Contains(t, out, "Blocked:  NOR-2, NOR-3")
	assert.Contains(t, out, "Created:  2026-02-28")
	assert.Contains(t, out, "Updated:  2026-02-28")
	assert.Contains(t, out, "## Description")
	assert.Contains(t, out, "Some description.")
	assert.Contains(t, out, "Comments (1):")
	assert.Contains(t, out, "[2026-02-28 alice] Working on it.")
}

func TestIssueDetail_Minimal(t *testing.T) {
	var buf bytes.Buffer
	issue := &model.Issue{
		Meta: model.IssueMeta{
			ID:       "NOR-1",
			Title:    "Minimal",
			Status:   "todo",
			Priority: "medium",
			Created:  "2026-02-28",
			Updated:  "2026-02-28",
		},
	}
	IssueDetail(&buf, issue)

	out := buf.String()
	assert.Contains(t, out, "ID:       NOR-1")
	assert.NotContains(t, out, "Labels:")
	assert.NotContains(t, out, "Parent:")
	assert.NotContains(t, out, "Blocked:")
	assert.NotContains(t, out, "Comments")
}

func TestJSON_Output(t *testing.T) {
	var buf bytes.Buffer
	data := map[string]string{"key": "value"}
	require.NoError(t, JSON(&buf, data))

	var result map[string]string
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))
	assert.Equal(t, "value", result["key"])
}

func TestJSON_NilSlice(t *testing.T) {
	var buf bytes.Buffer
	var data []string
	require.NoError(t, JSON(&buf, data))
	assert.Equal(t, "null\n", buf.String())
}

func TestJSON_EmptySlice(t *testing.T) {
	var buf bytes.Buffer
	data := []string{}
	require.NoError(t, JSON(&buf, data))
	assert.Equal(t, "[]\n", buf.String())
}

func TestJSONError_Output(t *testing.T) {
	var buf bytes.Buffer
	err := assert.AnError
	JSONError(&buf, err, 3)

	var result map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))
	assert.Contains(t, result, "error")
	assert.Equal(t, float64(3), result["code"])
}

func TestTextError_Output(t *testing.T) {
	var buf bytes.Buffer
	err := assert.AnError
	TextError(&buf, err)
	assert.Equal(t, "Error: "+err.Error()+"\n", buf.String())
}

func TestContextMarkdown_Full(t *testing.T) {
	var buf bytes.Buffer
	data := &ContextData{
		Project: &model.Config{
			Project: "TestProject",
			Prefix:  "NOR",
		},
		Issue: &model.Issue{
			Meta: model.IssueMeta{
				ID:       "NOR-3",
				Title:    "Auth feature",
				Status:   "in-progress",
				Priority: "high",
				Labels:   []string{"auth"},
				Comments: []model.Comment{
					{Author: "dev", Date: "2026-02-28", Body: "Started."},
				},
			},
			Body: "\n## Description\n\nImplement auth.\n",
		},
		BlockingIssues: []*model.Issue{
			{Meta: model.IssueMeta{ID: "NOR-2", Title: "DB setup", Status: "todo", Priority: "high"}},
		},
		ParentIssue: &model.Issue{
			Meta: model.IssueMeta{ID: "NOR-1", Title: "Infra", Status: "in-progress", Priority: "high"},
		},
		Documents: []DocContent{
			{Path: "docs/prd.md", Content: "# PRD\nRequirements."},
		},
	}

	ContextMarkdown(&buf, data, "/fake/root")

	out := buf.String()
	assert.Contains(t, out, "# Project: TestProject")
	assert.Contains(t, out, "# Issue: NOR-3 — Auth feature")
	assert.Contains(t, out, "Status: in-progress | Priority: high | Labels: auth")
	assert.Contains(t, out, "## Description")
	assert.Contains(t, out, "## Comments (1)")
	assert.Contains(t, out, "[2026-02-28 dev] Started.")
	assert.Contains(t, out, "# Blocking Issues")
	assert.Contains(t, out, "NOR-2 — DB setup")
	assert.Contains(t, out, "# Related Issues (parent)")
	assert.Contains(t, out, "NOR-1 — Infra")
	assert.Contains(t, out, "# Documents")
	assert.Contains(t, out, "docs/prd.md")
	assert.Contains(t, out, "Requirements.")
}

func TestContextMarkdown_Minimal(t *testing.T) {
	var buf bytes.Buffer
	data := &ContextData{
		Project: &model.Config{Project: "Minimal"},
		Issue: &model.Issue{
			Meta: model.IssueMeta{
				ID:       "NOR-1",
				Title:    "Simple",
				Status:   "todo",
				Priority: "medium",
			},
		},
	}

	ContextMarkdown(&buf, data, "/fake")

	out := buf.String()
	assert.Contains(t, out, "# Project: Minimal")
	assert.Contains(t, out, "# Issue: NOR-1 — Simple")
	assert.NotContains(t, out, "Labels:")
	assert.NotContains(t, out, "# Blocking Issues")
	assert.NotContains(t, out, "# Related Issues")
	assert.NotContains(t, out, "# Documents")
	assert.NotContains(t, out, "## Comments")
}
